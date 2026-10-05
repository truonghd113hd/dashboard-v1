import { createHash } from 'node:crypto';
import type { Column, Dataset, RecordRow } from '@dashboard/shared';
import { coerce, inferType } from '../lib/parse.js';

const filled = (c: unknown) => String(c ?? '').trim() !== '';

/** Sheet thường có tiêu đề/ghi chú phía trên bảng: header là dòng đầu tiên có số ô có dữ liệu >= 50% dòng "đầy" nhất trong 15 dòng đầu. */
export function detectHeaderRow(values: string[][]): number {
  const counts = values.slice(0, 15).map((r) => r.filter(filled).length);
  const max = Math.max(0, ...counts);
  if (max < 2) return 0;
  const idx = counts.findIndex((n) => n >= Math.max(2, max * 0.5));
  return idx === -1 ? 0 : idx;
}

/** Bảng = dãy ô header liền nhau; ô header trống đầu tiên là biên phải (các cột công thức phụ phía sau bị bỏ). */
function headerBlock(head: string[]): { start: number; names: string[] } {
  const start = Math.max(0, head.findIndex(filled));
  let end = start;
  while (end < head.length && filled(head[end])) end++;
  const seen = new Map<string, number>();
  const names = head.slice(start, end).map((h) => {
    const base = h.trim().replace(/\s+/g, ' ');
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}_${n}`;
  });
  return { start, names };
}

/** Tìm header tự động; các dòng sau header là data, dòng rỗng hoàn toàn bị bỏ qua. */
export function buildDataset(
  name: string,
  values: string[][],
  syncedAt = new Date().toISOString(),
  opts: { ignoreColumns?: string[] } = {},
): { dataset: Dataset; warnings: number } {
  const h = detectHeaderRow(values);
  const { start, names } = headerBlock(values[h] ?? []);
  const ignore = new Set((opts.ignoreColumns ?? []).map((c) => c.trim().toLowerCase()));
  const keep = names.map((n, i) => i).filter((i) => !ignore.has(names[i]!.toLowerCase()));
  const cell = (r: string[], i: number) => String(r[start + i] ?? '');
  const rows = values.slice(h + 1).filter((r) => keep.some((i) => filled(cell(r, i))));

  const columns: Column[] = keep.map((i) => ({ name: names[i]!, type: inferType(rows.map((r) => cell(r, i))) }));
  columns.forEach((c, k) => {
    if (c.type === 'string') c.distinct = new Set(rows.map((r) => cell(r, keep[k]!).trim()).filter(Boolean)).size;
  });

  let warnings = 0;
  const out: RecordRow[] = rows.map((r) => {
    const row: RecordRow = {};
    columns.forEach((c, k) => {
      const { value, bad } = coerce(cell(r, keep[k]!), c.type);
      if (bad) warnings++;
      row[c.name] = value;
    });
    return row;
  });

  const hash = createHash('sha1').update(JSON.stringify({ columns, rows: out })).digest('hex');
  return { dataset: { name, columns, rows: out, syncedAt, hash }, warnings };
}
