import { google } from 'googleapis';
import type { Config } from '../config.js';

export interface SheetTab {
  name: string;
  values: string[][];
}
export type TabFetcher = () => Promise<SheetTab[]>;

/** Đọc các tab từ Google Sheet bằng service account (sheet cần được share cho email của service account). */
export function createSheetFetcher(sync: Config['sync']): TabFetcher {
  return async () => {
    if (!sync.sheetId || !sync.keyFile) throw new Error('Thiếu GOOGLE_SHEET_ID hoặc GOOGLE_SERVICE_ACCOUNT_KEY_FILE');
    const auth = new google.auth.GoogleAuth({
      keyFile: sync.keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    let tabs = sync.tabs;
    if (tabs.length === 0) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sync.sheetId, fields: 'sheets.properties.title' });
      tabs = (meta.data.sheets ?? []).map((s) => s.properties?.title).filter((t): t is string => !!t);
    }
    if (tabs.length === 0) return [];

    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: sync.sheetId,
      ranges: tabs.map((t) => `'${t.replace(/'/g, "''")}'`),
      valueRenderOption: 'FORMATTED_VALUE',
    });
    return (res.data.valueRanges ?? []).map((vr, i) => ({
      name: tabs[i]!,
      values: (vr.values ?? []).map((row) => row.map((c) => String(c ?? ''))),
    }));
  };
}
