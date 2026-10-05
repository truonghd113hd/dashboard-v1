import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import type { Config } from './config.js';
import { registerRoutes } from './routes/index.js';
import { createSheetFetcher } from './services/sheet.service.js';
import { SyncService } from './services/sync.service.js';
import { DatasetRepo } from './store/dataset-repo.js';

export async function buildApp(config: Config) {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: config.corsOrigin.split(',') });

  // Tuỳ chọn: khoá toàn bộ web + API bằng Basic Auth (trừ /api/health cho healthcheck)
  if (config.basicAuth) {
    const sha = (s: string) => createHash('sha256').update(s).digest();
    const expected = { user: sha(config.basicAuth.user), password: sha(config.basicAuth.password) };
    app.addHook('onRequest', async (req, reply) => {
      if (req.url === '/api/health') return;
      const [user = '', ...rest] = Buffer.from((req.headers.authorization ?? '').replace(/^Basic /i, ''), 'base64').toString().split(':');
      // so sánh hash để timingSafeEqual luôn cùng độ dài
      if (timingSafeEqual(sha(user), expected.user) && timingSafeEqual(sha(rest.join(':')), expected.password)) return;
      return reply.header('WWW-Authenticate', 'Basic realm="Event Dashboard"').code(401).send({ error: 'Unauthorized' });
    });
  }

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) return reply.code(400).send({ error: 'Tham số không hợp lệ', issues: err.issues });
    app.log.error(err);
    return reply.code((err as { statusCode?: number }).statusCode ?? 500).send({ error: err instanceof Error ? err.message : 'Internal error' });
  });

  const repo = new DatasetRepo(`${config.dataDir}/datasets`);
  const enabled = Boolean(config.sync.sheetId && config.sync.keyFile);
  const sync = new SyncService(
    repo,
    createSheetFetcher(config.sync),
    { enabled, intervalMinutes: config.sync.intervalMinutes, dataDir: config.dataDir },
    { info: (m) => app.log.info(m), error: (e, m) => app.log.error(e, m) },
  );
  await sync.init();

  registerRoutes(app, { repo, sync });

  // Production (Docker): API phục vụ luôn bản build của web, route lạ ngoài /api trả index.html (SPA)
  if (config.webDir && existsSync(config.webDir)) {
    await app.register(fastifyStatic, { root: resolve(config.webDir) });
    app.setNotFoundHandler((req, reply) =>
      req.method === 'GET' && !req.url.startsWith('/api') ? reply.sendFile('index.html') : reply.code(404).send({ error: 'Not found' }),
    );
  }
  app.addHook('onClose', async () => sync.stop());
  return { app, sync };
}
