import type { BreakdownItem, Dataset, RecordRow, TaskDashboard } from '@dashboard/shared';

export const STATUS_ORDER = ['Backlog', 'Chờ', 'Cần thực hiện', 'Đang tiến hành', 'Đã hoàn thành', 'Đã lưu trữ'];
export const NO_STATUS = 'Chưa gán trạng thái';
const NO_ASSIGNEE = '(Chưa giao)';
const NO_CATEGORY = '(Chưa phân loại)';
const ARCHIVED = 'Đã lưu trữ';
const FINISHED = new Set(['Đã hoàn thành', ARCHIVED]);
const ALL = 'Tất cả';

export interface TaskFilters {
  status?: string;
  label?: string;
  assignee?: string;
  category?: string;
}

const text = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const labelsOf = (v: unknown) => text(v).split(/[;,]/).map((s) => s.trim()).filter(Boolean);
const active = (v?: string) => (v && v !== ALL ? v : undefined);
const count = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
const toItems = (m: Map<string, number>): BreakdownItem[] => [...m].map(([label, value]) => ({ label, value }));
const byValueDesc = (a: BreakdownItem, b: BreakdownItem) => b.value - a.value || a.label.localeCompare(b.label);
const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** Trả về null nếu dataset không phải bảng task (thiếu cột Task / Status / Assignee). */
export function taskDashboard(ds: Dataset, filters: TaskFilters, today: string): TaskDashboard | null {
  const has = (n: string) => ds.columns.some((c) => c.name === n);
  if (!['Task', 'Status', 'Assignee'].every(has)) return null;

  const rows = ds.rows.filter((r) => text(r['Task']));
  const statusOf = (r: RecordRow) => text(r['Status']) || NO_STATUS;
  const assigneeOf = (r: RecordRow) => text(r['Assignee']) || NO_ASSIGNEE;
  const categoryOf = (r: RecordRow) => text(r['Category']) || NO_CATEGORY;

  const options = {
    status: [...new Set(rows.map(statusOf))],
    label: [...new Set(rows.flatMap((r) => labelsOf(r['Label'])))].sort(),
    assignee: [...new Set(rows.map(assigneeOf))].sort(),
    category: [...new Set(rows.map(categoryOf))].sort(),
  };
  const statusOrder = [...STATUS_ORDER, ...options.status.filter((s) => !STATUS_ORDER.includes(s) && s !== NO_STATUS), NO_STATUS];
  options.status.sort((a, b) => statusOrder.indexOf(a) - statusOrder.indexOf(b));

  const f = { status: active(filters.status), label: active(filters.label), assignee: active(filters.assignee), category: active(filters.category) };
  const view = rows.filter(
    (r) =>
      (!f.status || statusOf(r) === f.status) &&
      (!f.label || labelsOf(r['Label']).includes(f.label)) &&
      (!f.assignee || assigneeOf(r) === f.assignee) &&
      (!f.category || categoryOf(r) === f.category),
  );

  const statusCount = new Map<string, number>();
  const category = new Map<string, number>();
  const label = new Map<string, number>();
  const priority = new Map<string, number>();
  const due = new Map<string, number>();
  const assignee = new Map<string, Map<string, number>>();
  let labelMissing = 0;
  let priorityMissing = 0;
  const overdue: TaskDashboard['overdue'] = [];

  for (const r of view) {
    const status = statusOf(r);
    count(statusCount, status);
    count(category, categoryOf(r));

    const ls = labelsOf(r['Label']);
    if (ls.length) ls.forEach((l) => count(label, l));
    else labelMissing++;

    const p = text(r['Priority']);
    if (p) count(priority, p);
    else priorityMissing++;

    const a = assigneeOf(r);
    if (!assignee.has(a)) assignee.set(a, new Map());
    count(assignee.get(a)!, status);

    const d = text(r['Due Date']).slice(0, 10);
    if (d) {
      count(due, d);
      if (d < today && !FINISHED.has(status)) overdue.push({ task: text(r['Task']), assignee: a, due: d, status, daysLate: dayDiff(d, today) });
    }
  }

  return {
    today,
    total: view.filter((r) => statusOf(r) !== ARCHIVED).length,
    overdueCount: overdue.length,
    statusOrder,
    statuses: statusOrder.map((s) => ({ status: s, count: statusCount.get(s) ?? 0 })).filter((s) => s.count > 0 || STATUS_ORDER.includes(s.status)),
    byAssignee: [...assignee]
      .map(([name, m]) => ({ name, total: [...m.values()].reduce((s, n) => s + n, 0), byStatus: Object.fromEntries(m) }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
    byCategory: toItems(category).sort(byValueDesc),
    byLabel: toItems(label).sort(byValueDesc),
    labelMissing,
    byPriority: toItems(priority).sort((a, b) => Number(a.label) - Number(b.label) || a.label.localeCompare(b.label)),
    priorityMissing,
    byDue: [...due].sort(([a], [b]) => a.localeCompare(b)).map(([date, n]) => ({ date, count: n })),
    overdue: overdue.sort((a, b) => b.daysLate - a.daysLate || a.task.localeCompare(b.task)),
    options,
  };
}
