import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Dataset, RecordsPage } from '@dashboard/shared';
import { toMeta, type DatasetRepo } from '../store/dataset-repo.js';
import type { SyncService } from '../services/sync.service.js';
import { breakdown, summary, timeseries, filterRows } from '../services/stats.service.js';
import { taskDashboard } from '../services/task-dashboard.service.js';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const range = { dateField: z.string().optional(), from: day, to: day };
const agg = z.enum(['sum', 'avg', 'count', 'min', 'max']).default('count');

export function registerRoutes(app: FastifyInstance, deps: { repo: DatasetRepo; sync: SyncService }) {
  const { repo, sync } = deps;

  const withDataset = async (name: string, reply: FastifyReply): Promise<Dataset | null> => {
    const ds = await repo.get(name);
    if (!ds) void reply.code(404).send({ error: `Dataset "${name}" không tồn tại` });
    return ds;
  };
  const nameParam = z.object({ name: z.string() });

  app.get('/api/health', async () => ({ ok: true }));

  app.get('/api/datasets', async () => (await repo.list()).map(toMeta));

  app.get('/api/datasets/:name', async (req, reply) => {
    const ds = await withDataset(nameParam.parse(req.params).name, reply);
    return ds ? toMeta(ds) : reply;
  });

  app.get('/api/datasets/:name/records', async (req, reply) => {
    const ds = await withDataset(nameParam.parse(req.params).name, reply);
    if (!ds) return reply;
    const q = z.object({
      ...range,
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(500).default(50),
      search: z.string().optional(),
      sort: z.string().optional(),
      order: z.enum(['asc', 'desc']).default('asc'),
    }).parse(req.query);

    let rows = filterRows(ds, q);
    if (q.search) {
      const s = q.search.toLowerCase();
      rows = rows.filter((r) => Object.values(r).some((v) => v !== null && String(v).toLowerCase().includes(s)));
    }
    if (q.sort && ds.columns.some((c) => c.name === q.sort)) {
      const dir = q.order === 'asc' ? 1 : -1;
      const key = q.sort;
      rows = [...rows].sort((a, b) => {
        const [x, y] = [a[key] ?? null, b[key] ?? null];
        if (x === y) return 0;
        if (x === null) return 1; // null luôn xuống cuối
        if (y === null) return -1;
        return (x < y ? -1 : 1) * dir;
      });
    }
    const page: RecordsPage = { total: rows.length, page: q.page, pageSize: q.pageSize, rows: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize) };
    return page;
  });

  app.get('/api/datasets/:name/stats/summary', async (req, reply) => {
    const ds = await withDataset(nameParam.parse(req.params).name, reply);
    return ds ? summary(ds, z.object(range).parse(req.query)) : reply;
  });

  app.get('/api/datasets/:name/stats/timeseries', async (req, reply) => {
    const ds = await withDataset(nameParam.parse(req.params).name, reply);
    if (!ds) return reply;
    const q = z.object({ ...range, metric: z.string().optional(), agg, groupBy: z.enum(['day', 'week', 'month']).default('day') }).parse(req.query);
    return timeseries(ds, q);
  });

  app.get('/api/datasets/:name/stats/breakdown', async (req, reply) => {
    const ds = await withDataset(nameParam.parse(req.params).name, reply);
    if (!ds) return reply;
    const q = z.object({ ...range, by: z.string(), metric: z.string().optional(), agg, limit: z.coerce.number().int().min(1).max(50).default(8) }).parse(req.query);
    if (!ds.columns.some((c) => c.name === q.by)) return reply.code(400).send({ error: `Cột "${q.by}" không tồn tại` });
    return breakdown(ds, q);
  });

  app.get('/api/dashboard/tasks', async (req, reply) => {
    const q = z.object({
      dataset: z.string().default('All Tasks'),
      status: z.string().optional(), label: z.string().optional(), assignee: z.string().optional(), category: z.string().optional(),
      today: day,
    }).parse(req.query);
    const ds = await withDataset(q.dataset, reply);
    if (!ds) return reply;
    const t = new Date();
    const localToday = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    const res = taskDashboard(ds, q, q.today ?? localToday);
    return res ?? reply.code(422).send({ error: `Dataset "${q.dataset}" không có đủ cột Task / Status / Assignee` });
  });

  app.get('/api/sync/status', async () => sync.getState());
  app.post('/api/sync/run', async (_req, reply) => {
    if (!sync.getState().enabled) return reply.code(409).send({ error: 'Sync chưa được cấu hình (thiếu GOOGLE_SHEET_ID)' });
    return sync.run('manual');
  });
}
