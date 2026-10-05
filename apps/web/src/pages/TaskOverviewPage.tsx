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
      </div>

      <TasksByCategory data={d} />

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

type Dash = NonNullable<ReturnType<typeof useTaskDashboard>['data']>;
type Detail = Dash['tasks'][number];
const DEFAULT_STATUS = 'Cần thực hiện';
const DEFAULT_FILTERS = { category: ALL, assignee: ALL, status: DEFAULT_STATUS, due: ALL };
const DUE_ALL = ALL, DUE_OVERDUE = 'Quá hạn', DUE_SET = 'Có hạn', DUE_NONE = 'Chưa có hạn';

/** Bảng chi tiết task, gom theo phân loại / dự án (thứ tự giống biểu đồ phân loại); lọc ngay trên bảng. */
function TasksByCategory({ data }: { data: Dash }) {
  const [f, setF] = useState(DEFAULT_FILTERS);

  // giá trị lọc lấy từ chính danh sách task đang có (đã qua bộ lọc phía trên)
  const uniq = (pick: (t: Detail) => string) => [...new Set(data.tasks.map(pick))];
  const opts = {
    category: data.byCategory.map((c) => c.label),
    assignee: uniq((t) => t.assignee).sort(),
    status: data.statusOrder.filter((st) => data.tasks.some((t) => t.status === st)),
  };
  // nếu giá trị đang chọn không còn tồn tại (do bộ lọc phía trên đổi) thì coi như "Tất cả"
  const eff = (k: keyof typeof opts) => (opts[k].includes(f[k]) ? f[k] : ALL);
  const sel = { category: eff('category'), assignee: eff('assignee'), status: eff('status') };

  const rows = data.tasks.filter(
    (t) =>
      (sel.category === ALL || t.category === sel.category) &&
      (sel.assignee === ALL || t.assignee === sel.assignee) &&
      (sel.status === ALL || t.status === sel.status) &&
      (f.due === DUE_ALL || (f.due === DUE_OVERDUE ? t.overdue : f.due === DUE_SET ? !!t.due : !t.due)),
  );
  const groups = data.byCategory.map((c) => ({ name: c.label, tasks: rows.filter((t) => t.category === c.label) })).filter((g) => g.tasks.length);
  const dirty = sel.category !== ALL || sel.assignee !== ALL || sel.status !== DEFAULT_STATUS || f.due !== DUE_ALL;
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Chi tiết task theo phân loại / dự án</h2>
          <p className="muted">{rows.length}/{data.tasks.length} task · sắp theo hạn chót trong từng nhóm</p>
        </div>
      </div>
      <div className="filters table-filters" aria-label="Lọc bảng chi tiết">
        <Filter label="Phân loại" value={sel.category} onChange={set('category')} options={opts.category} />
        <Filter label="Người thực hiện" value={sel.assignee} onChange={set('assignee')} options={opts.assignee} />
        <Filter label="Trạng thái" value={sel.status} onChange={set('status')} options={opts.status} />
        <Filter label="Hạn" value={f.due} onChange={set('due')} options={[DUE_OVERDUE, DUE_SET, DUE_NONE]} />
        {dirty && <button className="btn ghost" onClick={() => setF(DEFAULT_FILTERS)}>Về mặc định</button>}
      </div>
      {rows.length === 0 ? (
        <p className="muted pad">Không có task nào khớp bộ lọc.</p>
      ) : (
        <div className="table-wrap tall">
          <table>
            <thead><tr><th>Task</th><th>Người thực hiện</th><th>Trạng thái</th><th>Hạn</th></tr></thead>
            {groups.map((g) => (
              <tbody key={g.name}>
                <tr className="group-row"><th colSpan={4} scope="colgroup">{g.name} <span className="muted">· {g.tasks.length} task</span></th></tr>
                {g.tasks.map((t, i) => (
                  <tr key={i}>
                    <td className="wrap" title={t.description || undefined}>{t.task}</td>
                    <td>{t.assignee}</td>
                    <td>{t.status}</td>
                    <td className={t.overdue ? 'alert-text' : undefined}>{t.due ? `${t.overdue ? '⚠ ' : ''}${fmtDay(t.due)}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </section>
  );
}

function AssigneeTable({ data }: { data: Dash }) {
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
