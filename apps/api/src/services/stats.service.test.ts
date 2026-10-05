import { describe, expect, it } from 'vitest';
import { buildDataset } from './dataset-builder.js';
import { bucketOf, breakdown, summary, timeseries } from './stats.service.js';

const { dataset: ds } = buildDataset('t', [
  ['Ngày', 'Kênh', 'Doanh thu'],
  ['01/09/2026', 'A', '100'],
  ['01/09/2026', 'B', '50'],
  ['08/09/2026', 'A', '200'],
  ['', '', ''],
  ['09/09/2026', 'A', ''],
]);

describe('dataset-builder', () => {
  it('suy ra kiểu cột, bỏ dòng rỗng, đếm warning', () => {
    expect(ds.columns.map((c) => c.type)).toEqual(['date', 'string', 'number']);
    expect(ds.rows).toHaveLength(4);
  });
  it('ô không ép được kiểu => null + warning (khi cột vẫn đủ 90% hợp lệ)', () => {
    const vals = [['Số'], ...Array.from({ length: 10 }, (_, i) => [String(i)]), ['oops']];
    const r = buildDataset('w', vals);
    expect(r.dataset.columns[0]!.type).toBe('number');
    expect(r.warnings).toBe(1);
    expect(r.dataset.rows.at(-1)).toEqual({ Số: null });
  });
});

describe('stats', () => {
  it('bucketOf tuần bắt đầu thứ Hai', () => {
    expect(bucketOf('2026-09-06', 'week')).toBe('2026-08-31'); // Chủ nhật
    expect(bucketOf('2026-09-07', 'week')).toBe('2026-09-07');
    expect(bucketOf('2026-09-15', 'month')).toBe('2026-09-01');
  });
  it('timeseries sum theo ngày + lọc khoảng', () => {
    expect(timeseries(ds, { agg: 'sum', metric: 'Doanh thu', groupBy: 'day', to: '2026-09-01' })).toEqual([{ bucket: '2026-09-01', value: 150 }]);
  });
  it('breakdown sắp giảm dần', () => {
    expect(breakdown(ds, { by: 'Kênh', agg: 'sum', metric: 'Doanh thu', limit: 5 })).toEqual([
      { label: 'A', value: 300 },
      { label: 'B', value: 50 },
    ]);
  });
  it('summary', () => {
    const s = summary(ds, {});
    expect(s.dateRange).toEqual({ from: '2026-09-01', to: '2026-09-09' });
    expect(s.numeric[0]).toMatchObject({ column: 'Doanh thu', sum: 350, max: 200 });
  });
});
