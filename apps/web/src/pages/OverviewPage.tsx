import type { Agg, DatasetMeta, GroupBy } from '@dashboard/shared';
import { useState } from 'react';
import { useBreakdown, useSummary, useTimeseries } from '../api';
import { BreakdownChart, TimeseriesChart } from '../components/Charts';
import { ChartCard, Kpi } from '../components/Card';
import { daysAgo, fmtCompact, fmtFull } from '../format';

const AGG_LABEL: Record<Agg, string> = { count: 'Số dòng', sum: 'Tổng', avg: 'Trung bình', min: 'Nhỏ nhất', max: 'Lớn nhất' };
const GROUP_LABEL: Record<GroupBy, string> = { day: 'Ngày', week: 'Tuần', month: 'Tháng' };

export function OverviewPage({ meta }: { meta: DatasetMeta }) {
  const numeric = meta.columns.filter((c) => c.type === 'number');
  const dates = meta.columns.filter((c) => c.type === 'date');
  // cột phân loại: ít giá trị khác nhau (2..30); cột như "Họ tên" (gần như duy nhất) bị loại khỏi danh sách
  const strings = meta.columns.filter((c) => c.type === 'string' && (c.distinct ?? 0) >= 2 && (c.distinct ?? 0) <= 30);
  const defaultBy = [...strings].sort((a, b) => (a.distinct ?? 0) - (b.distinct ?? 0))[0]?.name ?? '';

  const [dateField, setDateField] = useState(dates[0]?.name ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [metric, setMetric] = useState(numeric[0]?.name ?? '');
  const [agg, setAgg] = useState<Agg>(numeric[0] ? 'sum' : 'count');
  const [by, setBy] = useState(defaultBy);

  const effAgg: Agg = metric ? agg : 'count';
  const range = { dateField, from, to };
  const measure = effAgg === 'count' ? 'Số dòng' : `${AGG_LABEL[effAgg]} ${metric}`;

  const summary = useSummary(meta.name, range);
  const ts = useTimeseries(meta.name, { ...range, metric, agg: effAgg, groupBy });
  const bd = useBreakdown(meta.name, { ...range, by, metric, agg: effAgg, limit: 8 }, !!by);

  const bounds = summary.data?.dateRange;
  const presets: [string, () => void][] = bounds
    ? [
        ['7 ngày', () => { setFrom(daysAgo(6, bounds.to)); setTo(bounds.to); }],
        ['30 ngày', () => { setFrom(daysAgo(29, bounds.to)); setTo(bounds.to); }],
        ['Tất cả', () => { setFrom(''); setTo(''); }],
      ]
    : [];

  return (
    <>
      <section className="filters card" aria-label="Bộ lọc">
        {dates.length > 0 && (
          <>
            {dates.length > 1 && (
              <Select label="Cột ngày" value={dateField} onChange={setDateField} options={dates.map((c) => [c.name, c.name])} />
            )}
            <label className="field"><span>Từ ngày</span><input type="date" value={from} min={bounds?.from} max={to || bounds?.to} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="field"><span>Đến ngày</span><input type="date" value={to} min={from || bounds?.from} max={bounds?.to} onChange={(e) => setTo(e.target.value)} /></label>
            <div className="presets">{presets.map(([l, fn]) => <button key={l} className="btn ghost" onClick={fn}>{l}</button>)}</div>
          </>
        )}
        <Select label="Chỉ số" value={metric} onChange={setMetric} options={[['', '(Đếm số dòng)'], ...numeric.map((c): [string, string] => [c.name, c.name])]} />
        <Select label="Phép tính" value={effAgg} onChange={(v) => setAgg(v as Agg)} disabled={!metric} options={(Object.keys(AGG_LABEL) as Agg[]).map((a): [string, string] => [a, AGG_LABEL[a]])} />
      </section>

      <section className="kpis" aria-label="Chỉ số tổng hợp">
        <Kpi label="Tổng số dòng" value={fmtFull(summary.data?.rowCount ?? 0)} hint={bounds ? `${bounds.from} → ${bounds.to}` : undefined} />
        {summary.data?.numeric.slice(0, 3).map((n) => (
          <Kpi key={n.column} label={`Tổng ${n.column}`} value={Math.abs(n.sum) < 1e6 ? fmtFull(n.sum) : fmtCompact(n.sum)} hint={`TB ${fmtFull(Math.round(n.avg * 100) / 100)}`} />
        ))}
      </section>

      {dates.length > 0 && (
        <ChartCard
          title={`${measure} theo ${GROUP_LABEL[groupBy].toLowerCase()}`}
          subtitle={dateField}
          rows={ts.data}
          labelOf={(r) => r.bucket}
          valueLabel={measure}
          loading={ts.isLoading}
          error={ts.error}
        >
          <div className="seg" role="group" aria-label="Nhóm theo">
            {(Object.keys(GROUP_LABEL) as GroupBy[]).map((g) => (
              <button key={g} aria-pressed={groupBy === g} onClick={() => setGroupBy(g)}>{GROUP_LABEL[g]}</button>
            ))}
          </div>
          <TimeseriesChart data={ts.data ?? []} groupBy={groupBy} name={measure} />
        </ChartCard>
      )}

      {strings.length > 0 && (
        <ChartCard
          title={`${measure} theo ${by}`}
          subtitle="Top 8, phần còn lại gộp vào “Khác” (với tổng / số dòng)"
          rows={bd.data}
          labelOf={(r) => r.label}
          valueLabel={measure}
          loading={bd.isLoading}
          error={bd.error}
        >
          <Select label="Nhóm theo" value={by} onChange={setBy} options={strings.map((c): [string, string] => [c.name, c.name])} />
          <BreakdownChart data={bd.data ?? []} name={measure} />
        </ChartCard>
      )}

      {dates.length === 0 && strings.length === 0 && <p className="muted">Dataset không có cột ngày hoặc cột chữ nên chưa vẽ được biểu đồ.</p>}
    </>
  );
}

function Select({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; disabled?: boolean }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
