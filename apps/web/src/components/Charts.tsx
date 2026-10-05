import type { BreakdownItem, GroupBy, TaskAssigneeRow, TimeseriesPoint } from '@dashboard/shared';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtBucket, fmtCompact, fmtDay, fmtFull } from '../format';

const tick = { fill: 'var(--text-muted)', fontSize: 12 };

function Tip({ active, payload, label, name }: { active?: boolean; payload?: { value: number }[]; label?: string; name: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip">
      <div className="tooltip-title">{label}</div>
      <div><span className="swatch" /> {name}: <strong>{fmtFull(payload[0]!.value)}</strong></div>
    </div>
  );
}

export function TimeseriesChart({ data, groupBy, name }: { data: TimeseriesPoint[]; groupBy: GroupBy; name: string }) {
  const rows = data.map((p) => ({ ...p, label: fmtBucket(p.bucket, groupBy) }));
  return (
    <div className="chart" role="img" aria-label={`Biểu đồ ${name} theo ${groupBy}`}>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} minTickGap={24} />
          <YAxis tick={tick} tickLine={false} axisLine={false} width={52} tickFormatter={fmtCompact} />
          <Tooltip content={<Tip name={name} />} cursor={{ stroke: 'var(--axis)' }} />
          <Area
            type="monotone" dataKey="value" stroke="var(--series-1)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            fill="var(--series-1)" fillOpacity={0.1} dot={false} isAnimationActive={false}
            activeDot={{ r: 5, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const truncate = (s: string) => (s.length > 18 ? `${s.slice(0, 17)}…` : s);

/** Bar ngang, một màu (một đại lượng trên nhiều nhóm => không cần màu theo nhóm), nhãn giá trị ở đầu bar. */
export function BreakdownChart({ data, name }: { data: BreakdownItem[]; name: string }) {
  const height = Math.max(160, data.length * 36 + 16);
  return (
    <div className="chart" role="img" aria-label={`Biểu đồ ${name}`}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barCategoryGap={12}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" width={120} tick={{ ...tick, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} tickFormatter={truncate} interval={0} />
          <Tooltip content={<Tip name={name} />} cursor={{ fill: 'var(--hover)' }} />
          <Bar dataKey="value" fill="var(--series-1)" barSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="value" position="right" formatter={(v: unknown) => fmtCompact(Number(v))} fill="var(--text-secondary)" fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Màu theo trạng thái, cố định theo thứ tự chuẩn (không đổi khi lọc) => không bao giờ tô lại màu của series còn lại. */
export const statusColor = (order: string[], status: string) => `var(--s${Math.min(order.indexOf(status), 7) + 1})`;

export function StatusLegend({ order, present }: { order: string[]; present: string[] }) {
  return (
    <ul className="legend" aria-label="Chú thích trạng thái">
      {order.filter((s) => present.includes(s)).map((s) => (
        <li key={s}><span className="swatch" style={{ background: statusColor(order, s) }} /> {s}</li>
      ))}
    </ul>
  );
}

function StackTip({ active, payload, label, order }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string; order: string[] }) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p) => p.value > 0);
  return (
    <div className="tooltip">
      <div className="tooltip-title">{label} · {items.reduce((s, p) => s + p.value, 0)} task</div>
      {items.map((p) => (
        <div key={p.dataKey}><span className="swatch" style={{ background: statusColor(order, p.dataKey) }} /> {p.dataKey}: <strong>{p.value}</strong></div>
      ))}
    </div>
  );
}

/** Task theo người thực hiện, xếp chồng theo trạng thái. */
export function AssigneeStackChart({ data, order }: { data: TaskAssigneeRow[]; order: string[] }) {
  const rows = data.map((a) => ({ name: a.name, ...a.byStatus }));
  const present = order.filter((s) => data.some((a) => a.byStatus[s]));
  return (
    <>
      <StatusLegend order={order} present={present} />
      <div className="chart" role="img" aria-label="Biểu đồ task theo người thực hiện và trạng thái">
        <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 36 + 16)}>
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barCategoryGap={12}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={110} tick={{ ...tick, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} tickFormatter={truncate} interval={0} />
            <Tooltip content={<StackTip order={order} />} cursor={{ fill: 'var(--hover)' }} />
            {present.map((s) => (
              <Bar key={s} dataKey={s} stackId="a" fill={statusColor(order, s)} stroke="var(--surface)" strokeWidth={2} barSize={20} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

/** Số task theo hạn chót; vạch đứng đánh dấu hôm nay. */
export function DueChart({ data, today }: { data: { date: string; count: number }[]; today: string }) {
  const days = data.some((d) => d.date === today) ? data : [...data, { date: today, count: 0 }].sort((a, b) => a.date.localeCompare(b.date));
  const rows = days.map((d) => ({ ...d, label: fmtDay(d.date) }));
  return (
    <div className="chart" role="img" aria-label="Biểu đồ số task theo hạn chót">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={rows} margin={{ top: 20, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} />
          <YAxis tick={tick} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <Tooltip content={<Tip name="Số task" />} cursor={{ fill: 'var(--hover)' }} />
          <ReferenceLine x={fmtDay(today)} stroke="var(--text-secondary)" label={{ value: 'Hôm nay', position: 'top', fill: 'var(--text-secondary)', fontSize: 12 }} />
          <Bar dataKey="count" fill="var(--series-1)" barSize={20} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            <LabelList dataKey="count" position="top" fill="var(--text-secondary)" fontSize={12} formatter={(v: unknown) => (Number(v) > 0 ? String(v) : '')} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
