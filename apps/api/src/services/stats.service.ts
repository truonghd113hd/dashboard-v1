import type { Agg, BreakdownItem, Dataset, GroupBy, NumericSummary, SummaryResult, TimeseriesPoint } from '@dashboard/shared';

export interface RangeOpts {
  dateField?: string;
  from?: string;
  to?: string;
}

export function defaultDateField(ds: Dataset, wanted?: string): string | null {
  if (wanted && ds.columns.some((c) => c.name === wanted && c.type === 'date')) return wanted;
  return ds.columns.find((c) => c.type === 'date')?.name ?? null;
}

export function filterRows(ds: Dataset, { dateField, from, to }: RangeOpts) {
  const field = defaultDateField(ds, dateField);
  if (!field || (!from && !to)) return ds.rows;
  return ds.rows.filter((r) => {
    const d = r[field];
    if (typeof d !== 'string') return false;
    const day = d.slice(0, 10);
    return (!from || day >= from) && (!to || day <= to);
  });
}

class Acc {
  sum = 0;
  count = 0;
  min = Infinity;
  max = -Infinity;
  add(v: number) {
    this.sum += v;
    this.count++;
    if (v < this.min) this.min = v;
    if (v > this.max) this.max = v;
  }
  result(agg: Agg): number {
    if (this.count === 0) return 0;
    switch (agg) {
      case 'sum': return this.sum;
      case 'avg': return this.sum / this.count;
      case 'min': return this.min;
      case 'max': return this.max;
      case 'count': return this.count;
    }
  }
}

/** 'count' đếm số dòng; các agg khác cần metric là cột number (ô null bị bỏ qua). */
function accumulate(acc: Acc, row: Record<string, unknown>, agg: Agg, metric?: string) {
  if (agg === 'count' || !metric) return acc.add(1);
  const v = row[metric];
  if (typeof v === 'number') acc.add(v);
}

export function bucketOf(date: string, g: GroupBy): string {
  const day = date.slice(0, 10);
  if (g === 'day') return day;
  if (g === 'month') return `${day.slice(0, 7)}-01`;
  const dt = new Date(`${day}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7)); // về thứ Hai
  return dt.toISOString().slice(0, 10);
}

export function summary(ds: Dataset, opts: RangeOpts): SummaryResult {
  const rows = filterRows(ds, opts);
  const dateField = defaultDateField(ds, opts.dateField);

  let dateRange: SummaryResult['dateRange'] = null;
  if (dateField) {
    const days = ds.rows.map((r) => r[dateField]).filter((d): d is string => typeof d === 'string').map((d) => d.slice(0, 10)).sort();
    if (days.length) dateRange = { from: days[0]!, to: days[days.length - 1]! };
  }

  const numeric: NumericSummary[] = ds.columns
    .filter((c) => c.type === 'number')
    .map((c) => {
      const acc = new Acc();
      for (const r of rows) if (typeof r[c.name] === 'number') acc.add(r[c.name] as number);
      return { column: c.name, sum: acc.sum, avg: acc.result('avg'), min: acc.count ? acc.min : 0, max: acc.count ? acc.max : 0 };
    });

  return { rowCount: rows.length, dateField, dateRange, numeric };
}

export function timeseries(ds: Dataset, o: RangeOpts & { metric?: string; agg: Agg; groupBy: GroupBy }): TimeseriesPoint[] {
  const field = defaultDateField(ds, o.dateField);
  if (!field) return [];
  const buckets = new Map<string, Acc>();
  for (const r of filterRows(ds, o)) {
    const d = r[field];
    if (typeof d !== 'string') continue;
    const key = bucketOf(d, o.groupBy);
    let acc = buckets.get(key);
    if (!acc) buckets.set(key, (acc = new Acc()));
    accumulate(acc, r, o.agg, o.metric);
  }
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([bucket, acc]) => ({ bucket, value: acc.result(o.agg) }));
}

export function breakdown(ds: Dataset, o: RangeOpts & { by: string; metric?: string; agg: Agg; limit: number }): BreakdownItem[] {
  const groups = new Map<string, Acc>();
  for (const r of filterRows(ds, o)) {
    const raw = r[o.by];
    const label = raw === null || raw === undefined ? '(trống)' : String(raw);
    let acc = groups.get(label);
    if (!acc) groups.set(label, (acc = new Acc()));
    accumulate(acc, r, o.agg, o.metric);
  }
  const items = [...groups.entries()].map(([label, acc]) => ({ label, value: acc.result(o.agg) })).sort((a, b) => b.value - a.value);
  if (items.length <= o.limit) return items;
  // phần đuôi gộp vào "Khác" (chỉ hợp lý với sum/count)
  const head = items.slice(0, o.limit - 1);
  const tail = items.slice(o.limit - 1);
  if (o.agg === 'sum' || o.agg === 'count') return [...head, { label: 'Khác', value: tail.reduce((s, i) => s + i.value, 0) }];
  return items.slice(0, o.limit);
}
