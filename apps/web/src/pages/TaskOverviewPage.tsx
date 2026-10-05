import { useState } from 'react';
import { useTaskDashboard } from '../api';
import { AssigneeStackChart, BreakdownChart, DueChart } from '../components/Charts';
import { ChartCard, Kpi } from '../components/Card';
import { fmtDay, today } from '../format';

type Filters = { status: string; label: string; assignee: string; category: string };
const ALL = 'Tất cả';

export function TaskOverviewPage({ dataset }: { dataset: string }) {
  const [f, setF] = useState<Filters>({ status: ALL, label: ALL, assignee: ALL, category: ALL });
  const [day] = useState(today);
  const q = useTaskDashboard({ dataset, ...f, today: day });
  const d = q.data;

  if (q.error && !d) return <p className="error">Không tải được: {q.error.message}</p>;
  if (!d) return <p className="muted">Đang tải…</p>;

  const set = (k: keyof Filters) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const filtered = Object.values(f).some((v) => v !== ALL);

  return (
    <>
      <section className="filters card" aria-label="Bộ lọc task">
        <Filter label="Trạng thái" value={f.status} onChange={set('status')} options={d.options.status} />
        <Filter label="Nhãn" value={f.label} onChange={set('label')} options={d.options.label} />
        <Filter label="Người thực hiện" value={f.assignee} onChange={set('assignee')} options={d.options.assignee} />
        <Filter label="Phân loại / dự án" value={f.category} onChange={set('category')} options={d.options.category} />
        {filtered && <button className="btn ghost" onClick={() => setF({ status: ALL, label: ALL, assignee: ALL, category: ALL })}>Xoá lọc</button>}
      </section>

      <section className="kpis" aria-label="Số task theo trạng thái">
        {d.statuses.map((s) => (
          <Kpi key={s.status} label={s.status} value={String(s.count)} hint={s.status === 'Chưa gán trạng thái' && s.count > 0 ? 'Cột Trạng thái trong sheet còn trống' : undefined} />
        ))}
        <Kpi label="Tổng task" value={String(d.total)} hint="Không tính “Đã lưu trữ”" />
        <div className={`kpi ${d.overdueCount ? 'kpi-alert' : ''}`}>
          <span className="kpi-label">{d.overdueCount ? '⚠ ' : ''}Quá hạn</span>
          <span className="kpi-value">{d.overdueCount}</span>
          <span className="kpi-hint">Hạn trước {fmtDay(d.today)}, chưa xong</span>
        </div>
      </section>

      <div className="grid2">
        <ChartCard
          title="Task theo người thực hiện"
          subtitle="Xếp chồng theo trạng thái"
          rows={d.byAssignee.map((a) => ({ ...a, value: a.total }))}
          labelOf={(r) => r.name}
          valueLabel="Số task"
          table={<AssigneeTable data={d} />}
        >
          <AssigneeStackChart data={d.byAssignee} order={d.statusOrder} />
        </ChartCard>

        <ChartCard title="Task theo phân loại / dự án" rows={d.byCategory} labelOf={(r) => r.label} valueLabel="Số task">
          <BreakdownChart data={d.byCategory} name="Số task" />
        </ChartCard>

        <ChartCard
          title="Task theo nhãn"
          subtitle={d.labelMissing ? `${d.labelMissing} task chưa gắn nhãn (không hiển thị)` : undefined}
          rows={d.byLabel}
          labelOf={(r) => r.label}
          valueLabel="Số task"
        >
          <BreakdownChart data={d.byLabel} name="Số task" />
        </ChartCard>

        <ChartCard
          title="Task theo mức độ ưu tiên"
          subtitle={d.priorityMissing ? `${d.priorityMissing} task chưa có mức ưu tiên (không hiển thị)` : undefined}
          rows={d.byPriority}
          labelOf={(r) => `Mức ${r.label}`}
          valueLabel="Số task"
        >
          <BreakdownChart data={d.byPriority.map((p) => ({ ...p, label: `Mức ${p.label}` }))} name="Số task" />
        </ChartCard>
      </div>

      <ChartCard title="Task theo hạn chót" rows={d.byDue.map((x) => ({ ...x, value: x.count }))} labelOf={(r) => fmtDay(r.date)} valueLabel="Số task" subtitle="Task chưa có hạn không hiển thị">
        <DueChart data={d.byDue} today={d.today} />
      </ChartCard>

      <section className="card">
        <div className="card-head">
          <h2><span className={d.overdueCount ? 'alert-text' : ''}>{d.overdueCount ? '⚠ ' : ''}Task quá hạn</span></h2>
        </div>
        {d.overdue.length === 0 ? (
          <p className="muted pad">Không có task nào quá hạn 🎉</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Task</th><th>Người thực hiện</th><th>Trạng thái</th><th>Hạn</th><th className="num">Trễ</th></tr></thead>
              <tbody>
                {d.overdue.map((o, i) => (
                  <tr key={i}>
                    <td className="wrap">{o.task}</td><td>{o.assignee}</td><td>{o.status}</td><td>{fmtDay(o.due)}</td>
                    <td className="num alert-text">{o.daysLate} ngày</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function AssigneeTable({ data }: { data: NonNullable<ReturnType<typeof useTaskDashboard>['data']> }) {
  const cols = data.statusOrder.filter((s) => data.byAssignee.some((a) => a.byStatus[s]));
  return (
    <table>
      <thead><tr><th>Người thực hiện</th>{cols.map((c) => <th key={c} className="num">{c}</th>)}<th className="num">Tổng</th></tr></thead>
      <tbody>
        {data.byAssignee.map((a) => (
          <tr key={a.name}><td>{a.name}</td>{cols.map((c) => <td key={c} className="num">{a.byStatus[c] ?? ''}</td>)}<td className="num">{a.total}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {[ALL, ...options].map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}
