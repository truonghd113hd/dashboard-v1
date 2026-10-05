import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const { app, sync } = await buildApp(config);

await app.listen({ port: config.port, host: '0.0.0.0' });
if (!sync.getState().enabled) app.log.warn('Google Sheet sync đang TẮT (thiếu GOOGLE_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_KEY_FILE). Chạy `pnpm seed` để có data mẫu.');
sync.start();
