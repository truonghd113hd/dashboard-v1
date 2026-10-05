import { describe, expect, it } from 'vitest';
import { buildDataset, detectHeaderRow } from './dataset-builder.js';
import { taskDashboard } from './task-dashboard.service.js';

const sheet = [
  ['All Tasks'],
  [],
  [],
  ['Task', 'Priority', 'Assignee', 'Label', 'Category', 'Due Date', 'Status', '', 'Helper'],
  ['A', '5', 'Dung', 'x; y', 'P1', '04/10/2026', 'Cần thực hiện', '', 'h'],
  ['B', '', 'Dung', '', 'P1', '06/10/2026', 'Đang tiến hành', '', 'h'],
  ['C', '3', '', 'x', 'P2', '01/10/2026', 'Đã hoàn thành', '', 'h'],
  ['D', '', 'Xanh', '', '', '', '', '', 'h'],
  ['E', '', 'Xanh', '', 'P2', '02/10/2026', 'Đã lưu trữ', '', 'h'],
];
const { dataset: ds } = buildDataset('All Tasks', sheet);
// P1: A(04/10), B(06/10) · P2: E(02/10), C(01/10) -> C trước E · (Chưa phân loại): D
const order = ['A', 'B', 'C', 'E', 'D'];
const dash = (f = {}) => taskDashboard(ds, f, '2026-10-05')!;

describe('buildDataset với tiêu đề phía trên + cột phụ', () => {
  it('tìm đúng header, bỏ cột sau ô header trống', () => {
    expect(detectHeaderRow(sheet)).toBe(3);
    expect(ds.columns.map((c) => c.name)).toEqual(['Task', 'Priority', 'Assignee', 'Label', 'Category', 'Due Date', 'Status']);
    expect(ds.rows).toHaveLength(5);
  });
});

describe('ignoreColumns', () => {
  it('bỏ cột chỉ định (không phân biệt hoa thường), các cột còn lại giữ nguyên dữ liệu', () => {
    const r = buildDataset('t', sheet, undefined, { ignoreColumns: ['priority'] }).dataset;
    expect(r.columns.map((c) => c.name)).toEqual(['Task', 'Assignee', 'Label', 'Category', 'Due Date', 'Status']);
    expect(r.rows[0]).toMatchObject({ Task: 'A', Assignee: 'Dung', Status: 'Cần thực hiện' });
    expect('Priority' in r.rows[0]!).toBe(false);
  });
});

describe('taskDashboard', () => {
  it('đếm trạng thái, tổng không tính lưu trữ, task chưa gán trạng thái', () => {
    const d = dash();
    expect(d.total).toBe(4);
    expect(Object.fromEntries(d.statuses.map((s) => [s.status, s.count]))).toMatchObject({ 'Cần thực hiện': 1, 'Đang tiến hành': 1, 'Đã hoàn thành': 1, 'Đã lưu trữ': 1, 'Chưa gán trạng thái': 1, Backlog: 0 });
  });
  it('quá hạn = hạn < hôm nay và chưa xong/lưu trữ', () => {
    expect(dash().overdue).toEqual([{ task: 'A', assignee: 'Dung', due: '2026-10-04', status: 'Cần thực hiện', daysLate: 1 }]);
  });
  it('label nhiều giá trị được tách, thiếu thì đếm riêng', () => {
    const d = dash();
    expect(d.byLabel).toEqual([{ label: 'x', value: 2 }, { label: 'y', value: 1 }]);
    expect(d.labelMissing).toBe(3);
  });
  it('bộ lọc áp dụng cho mọi khối nhưng options giữ nguyên', () => {
    const d = dash({ assignee: 'Dung' });
    expect(d.byAssignee).toHaveLength(1);
    expect(d.options.assignee).toContain('Xanh');
    expect(dash({ label: 'Tất cả' }).byAssignee).toHaveLength(3);
  });
  it('tasks sắp theo phân loại (nhiều task trước) rồi theo hạn, đánh dấu quá hạn', () => {
    const t = dash().tasks;
    expect(t.map((x) => x.task)).toEqual(['A', 'B', 'E', 'C', 'D'].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
    expect(t.find((x) => x.task === 'A')).toMatchObject({ category: 'P1', overdue: true, due: '2026-10-04' });
    expect(t.find((x) => x.task === 'B')!.overdue).toBe(false);
  });
  it('trả null nếu không phải bảng task', () => {
    expect(taskDashboard(buildDataset('t', [['a', 'b'], ['1', '2']]).dataset, {}, '2026-10-05')).toBeNull();
  });
});
