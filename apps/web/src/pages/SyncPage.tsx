import { useRunSync, useSyncStatus } from '../api';
import { fmtFull } from '../format';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN') : '—');

export function SyncPage() {
  const { data: s, isLoading, error } = useSyncStatus();
  const run = useRunSync();

  if (isLoading) return <p className="muted">Đang tải…</p>;
  if (error || !s) return <p className="error">Không tải được trạng thái sync.</p>;

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Đồng bộ Google Sheet</h2>
          <p className="muted">{s.enabled ? `Tự động poll mỗi ${s.intervalMinutes} phút` : 'Chưa cấu hình — đặt GOOGLE_SHEET_ID và GOOGLE_SERVICE_ACCOUNT_KEY_FILE trong .env của API'}</p>
        </div>
        <button className="btn" disabled={!s.enabled || s.status === 'running' || run.isPending} onClick={() => run.mutate()}>
          {s.status === 'running' ? 'Đang sync…' : 'Sync ngay'}
        </button>
      </div>

      {s.error && <p className="error" role="alert">✕ Lỗi lần sync gần nhất: {s.error} (dữ liệu cũ vẫn được giữ nguyên)</p>}
      {run.error && <p className="error" role="alert">{run.error.message}</p>}

      <dl className="facts">
        <div><dt>Lần chạy gần nhất</dt><dd>{when(s.lastRunAt)}</dd></div>
        <div><dt>Lần thành công gần nhất</dt><dd>{when(s.lastSuccessAt)}</dd></div>
        <div><dt>Kích hoạt bởi</dt><dd>{s.trigger ?? '—'}</dd></div>
        <div><dt>Thời gian chạy</dt><dd>{s.durationMs === null ? '—' : `${fmtFull(s.durationMs)} ms`}</dd></div>
      </dl>

      {s.datasets.length > 0 && (
        <div className="table-wrap short">
          <table>
            <thead><tr><th>Tab</th><th className="num">Số dòng</th><th>Thay đổi</th><th className="num">Ô lỗi kiểu</th></tr></thead>
            <tbody>
              {s.datasets.map((d) => (
                <tr key={d.name}><td>{d.name}</td><td className="num">{fmtFull(d.rows)}</td><td>{d.changed ? 'Có cập nhật' : 'Không đổi'}</td><td className="num">{d.warnings}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
