import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATA_DIR: z.string().default('./data'),
  WEB_DIST_DIR: z.string().optional(),
  BASIC_AUTH_USER: z.string().optional(),
  BASIC_AUTH_PASSWORD: z.string().optional(),
  GOOGLE_SHEET_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_KEY_FILE: z.string().optional(),
  GOOGLE_SHEET_TABS: z.string().optional(),
  GOOGLE_SHEET_IGNORE_COLUMNS: z.string().optional(),
  SYNC_INTERVAL_MINUTES: z.coerce.number().positive().default(5),
});

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  // `KEY=` trong .env cho ra chuỗi rỗng => coi như chưa set
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ''));
  const e = schema.parse(cleaned);
  return {
    port: e.PORT,
    corsOrigin: e.CORS_ORIGIN,
    dataDir: e.DATA_DIR,
    webDir: e.WEB_DIST_DIR,
    basicAuth: e.BASIC_AUTH_USER && e.BASIC_AUTH_PASSWORD ? { user: e.BASIC_AUTH_USER, password: e.BASIC_AUTH_PASSWORD } : undefined,
    sync: {
      sheetId: e.GOOGLE_SHEET_ID,
      keyFile: e.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
      tabs: (e.GOOGLE_SHEET_TABS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      ignoreColumns: (e.GOOGLE_SHEET_IGNORE_COLUMNS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
      intervalMinutes: e.SYNC_INTERVAL_MINUTES,
    },
  };
}
