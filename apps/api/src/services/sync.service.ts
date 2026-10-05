import { join } from 'node:path';
import type { SyncState } from '@dashboard/shared';
import type { Config } from '../config.js';
import { DatasetRepo } from '../store/dataset-repo.js';
import { readJson, writeJsonAtomic } from '../store/json-store.js';
import { buildDataset } from './dataset-builder.js';
import type { TabFetcher } from './sheet.service.js';

export class SyncService {
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private state: SyncState;
  private readonly stateFile: string;

  constructor(
    private readonly repo: DatasetRepo,
    private readonly fetchTabs: TabFetcher,
    private readonly opts: { enabled: boolean; intervalMinutes: number; dataDir: string },
    private readonly log: { info: (m: string) => void; error: (e: unknown, m: string) => void } = console as never,
  ) {
    this.stateFile = join(opts.dataDir, 'sync-state.json');
    this.state = {
      status: opts.enabled ? 'idle' : 'disabled',
      enabled: opts.enabled,
      intervalMinutes: opts.intervalMinutes,
      trigger: null,
      lastRunAt: null,
      lastSuccessAt: null,
      durationMs: null,
      datasets: [],
      error: null,
    };
  }

  async init() {
    const saved = await readJson<SyncState | null>(this.stateFile, null);
    if (saved) {
      this.state = { ...saved, status: this.opts.enabled ? (saved.status === 'running' ? 'idle' : saved.status) : 'disabled', enabled: this.opts.enabled, intervalMinutes: this.opts.intervalMinutes };
    }
  }

  getState(): SyncState {
    return this.state;
  }

  /** Chạy ngay 1 lần rồi poll theo interval. */
  start() {
    if (!this.opts.enabled) return;
    void this.run('startup');
    this.timer = setInterval(() => void this.run('interval'), this.opts.intervalMinutes * 60_000);
    this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Lock: nếu đang sync thì trả về state hiện tại, không chạy chồng. */
  async run(trigger: 'startup' | 'interval' | 'manual'): Promise<SyncState> {
    if (!this.opts.enabled || this.running) return this.state;
    this.running = true;
    const startedAt = Date.now();
    this.state = { ...this.state, status: 'running', trigger, lastRunAt: new Date(startedAt).toISOString(), error: null };

    try {
      const tabs = await this.fetchTabs();
      const results: SyncState['datasets'] = [];
      for (const tab of tabs) {
        const { dataset, warnings } = buildDataset(tab.name, tab.values);
        const prev = await this.repo.get(tab.name);
        const changed = prev?.hash !== dataset.hash;
        if (changed) await this.repo.save(dataset);
        results.push({ name: tab.name, rows: dataset.rows.length, changed, warnings });
      }
      // tab đã bị xoá khỏi sheet thì xoá dataset tương ứng
      const keep = new Set(tabs.map((t) => t.name));
      for (const ds of await this.repo.list()) if (!keep.has(ds.name)) await this.repo.remove(ds.name);

      this.state = { ...this.state, status: 'ok', datasets: results, lastSuccessAt: new Date().toISOString(), durationMs: Date.now() - startedAt };
      this.log.info(`sync ok (${trigger}): ${results.map((r) => `${r.name}=${r.rows}${r.changed ? '*' : ''}`).join(', ')}`);
    } catch (err) {
      // giữ nguyên dữ liệu cũ khi sync lỗi
      this.state = { ...this.state, status: 'error', error: err instanceof Error ? err.message : String(err), durationMs: Date.now() - startedAt };
      this.log.error(err, 'sync failed');
    } finally {
      this.running = false;
      await writeJsonAtomic(this.stateFile, this.state).catch(() => undefined);
    }
    return this.state;
  }
}
