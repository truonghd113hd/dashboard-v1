export type ColumnType = 'number' | 'date' | 'string';
export type CellValue = string | number | null;
export type RecordRow = Record<string, CellValue>;

export interface Column {
  name: string;
  type: ColumnType;
  /** Số giá trị khác nhau (chỉ có với cột string) — dùng để chọn cột phân loại hợp lý. */
  distinct?: number;
}

/** Một tab của Google Sheet, được lưu thành 1 file JSON. */
export interface Dataset {
  name: string;
  columns: Column[];
  rows: RecordRow[];
  syncedAt: string;
  hash: string;
}

export interface DatasetMeta {
  name: string;
  columns: Column[];
  rowCount: number;
  syncedAt: string;
}

export type Agg = 'sum' | 'avg' | 'count' | 'min' | 'max';
export type GroupBy = 'day' | 'week' | 'month';

export interface NumericSummary {
  column: string;
  sum: number;
  avg: number;
  min: number;
  max: number;
}
export interface SummaryResult {
  rowCount: number;
  dateField: string | null;
  dateRange: { from: string; to: string } | null;
  numeric: NumericSummary[];
}
export interface TimeseriesPoint {
  bucket: string;
  value: number;
}
export interface BreakdownItem {
  label: string;
  value: number;
}
export interface RecordsPage {
  total: number;
  page: number;
  pageSize: number;
  rows: RecordRow[];
}

export type SyncStatus = 'disabled' | 'idle' | 'running' | 'ok' | 'error';
export interface SyncDatasetResult {
  name: string;
  rows: number;
  changed: boolean;
  warnings: number;
}
export interface SyncState {
  status: SyncStatus;
  enabled: boolean;
  intervalMinutes: number;
  trigger: 'startup' | 'interval' | 'manual' | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  durationMs: number | null;
  datasets: SyncDatasetResult[];
  error: string | null;
}

export interface TaskAssigneeRow {
  name: string;
  total: number;
  byStatus: Record<string, number>;
}
export interface TaskOverdueRow {
  task: string;
  assignee: string;
  due: string;
  status: string;
  daysLate: number;
}
export interface TaskDetail {
  task: string;
  description: string;
  category: string;
  assignee: string;
  status: string;
  due: string;
  overdue: boolean;
}
/** Dữ liệu cho trang "Tổng quan" (task board): tính từ dataset All Tasks. */
export interface TaskDashboard {
  today: string;
  /** Tổng task, không tính "Đã lưu trữ". */
  total: number;
  overdueCount: number;
  statusOrder: string[];
  statuses: { status: string; count: number }[];
  byAssignee: TaskAssigneeRow[];
  byCategory: BreakdownItem[];
  byLabel: BreakdownItem[];
  labelMissing: number;
  byDue: { date: string; count: number }[];
  overdue: TaskOverdueRow[];
  /** Toàn bộ task sau khi lọc, đã sắp theo phân loại (nhiều task nhất trước) rồi theo hạn. */
  tasks: TaskDetail[];
  options: { status: string[]; label: string[]; assignee: string[]; category: string[] };
}
