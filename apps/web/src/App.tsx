import { useState } from 'react';
import { useDatasets, useSyncStatus } from './api';
import { DataPage } from './pages/DataPage';
import { OverviewPage } from './pages/OverviewPage';
import { SyncPage } from './pages/SyncPage';
import { TaskOverviewPage } from './pages/TaskOverviewPage';
import { ThemeToggle } from './components/ThemeToggle';

type Tab = 'tasks' | 'analysis' | 'data' | 'sync';
const TABS: [Tab, string][] = [['tasks', 'Tổng quan'], ['analysis', 'Phân tích'], ['data', 'Dữ liệu'], ['sync', 'Đồng bộ']];
const TASK_DATASET = 'All Tasks';

export function App() {
  const [tab, setTab] = useState<Tab>('tasks');
  const [picked, setPicked] = useState('');
  const datasets = useDatasets();
  const sync = useSyncStatus();

  const list = datasets.data ?? [];
  const meta = list.find((d) => d.name === picked) ?? list.find((d) => d.name === TASK_DATASET) ?? list[0];
  const picker = (tab === 'analysis' || tab === 'data') && list.length > 1;

  return (
    <div className="shell">
      <header className="topbar">
        <h1>Event Dashboard</h1>
        <nav aria-label="Trang">
          {TABS.map(([id, label]) => (
            <button key={id} className="tab" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          <ThemeToggle />
          {picker && (
            <label className="field inline">
              <span>Dataset</span>
              <select value={meta?.name ?? ''} onChange={(e) => setPicked(e.target.value)}>
                {list.map((d) => <option key={d.name}>{d.name}</option>)}
              </select>
            </label>
          )}
          {sync.data && (
            <span className={`pill pill-${sync.data.status}`} title={sync.data.error ?? undefined}>
              <span aria-hidden>{{ ok: '✓', error: '✕', running: '↻', idle: '•', disabled: '–' }[sync.data.status]}</span> {STATUS_LABEL[sync.data.status]}
              {sync.data.lastSuccessAt && sync.data.status !== 'running' ? ` · ${new Date(sync.data.lastSuccessAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
          )}
        </div>
      </header>

      <main>
        {tab === 'sync' ? (
          <SyncPage />
        ) : datasets.isLoading ? (
          <p className="muted">Đang tải…</p>
        ) : !meta ? (
          <div className="card empty">
            <h2>Chưa có dữ liệu</h2>
            <p>Cấu hình Google Sheet trong <code>apps/api/.env</code> để bắt đầu sync, hoặc chạy <code>pnpm seed</code> để tạo data mẫu.</p>
          </div>
        ) : tab === 'tasks' ? (
          list.some((d) => d.name === TASK_DATASET) ? (
            <TaskOverviewPage dataset={TASK_DATASET} />
          ) : (
            <div className="card empty"><h2>Chưa có tab “{TASK_DATASET}”</h2><p>Kiểm tra <code>GOOGLE_SHEET_TABS</code> và trạng thái ở trang Đồng bộ.</p></div>
          )
        ) : tab === 'analysis' ? (
          <OverviewPage key={meta.name} meta={meta} />
        ) : (
          <DataPage key={meta.name} meta={meta} />
        )}
      </main>
    </div>
  );
}

const STATUS_LABEL = { ok: 'Đã sync', error: 'Sync lỗi', running: 'Đang sync', idle: 'Chờ sync', disabled: 'Sync tắt' } as const;
