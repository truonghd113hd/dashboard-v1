import { useState, type ReactNode } from 'react';
import { fmtFull } from '../format';

/** Khung chart + nút chuyển sang dạng bảng (kênh truy cập thay thế cho chart). */
export function ChartCard<T extends { value: number }>({
  title, subtitle, rows, labelOf, valueLabel, loading, error, table: customTable, children,
}: {
  title: string;
  subtitle?: string;
  rows?: T[];
  labelOf: (r: T) => string;
  valueLabel: string;
  loading?: boolean;
  error?: Error | null;
  /** Bảng thay thế tuỳ biến (vd. nhiều cột); mặc định là bảng nhãn/giá trị. */
  table?: ReactNode;
  children: ReactNode;
}) {
  const [table, setTable] = useState(false);
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        <button className="btn ghost" aria-pressed={table} onClick={() => setTable((t) => !t)} disabled={!rows?.length}>
          {table ? 'Xem biểu đồ' : 'Xem bảng'}
        </button>
      </div>
      {error ? (
        <p className="error">Không tải được: {error.message}</p>
      ) : loading && !rows ? (
        <p className="muted pad">Đang tải…</p>
      ) : !rows?.length ? (
        <p className="muted pad">Không có dữ liệu trong khoảng này.</p>
      ) : table && customTable ? (
        <div className="table-wrap short">{customTable}</div>
      ) : table ? (
        <div className="table-wrap short">
          <table>
            <thead><tr><th>Nhãn</th><th className="num">{valueLabel}</th></tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}><td>{labelOf(r)}</td><td className="num">{fmtFull(r.value)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : children}
    </section>
  );
}

export function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  );
}
