import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Dataset, DatasetMeta } from '@dashboard/shared';
import { readJson, writeJsonAtomic } from './json-store.js';

export class DatasetRepo {
  private cache = new Map<string, Dataset>();

  constructor(private readonly dir: string) {}

  private file(name: string) {
    return join(this.dir, `${encodeURIComponent(name)}.json`);
  }

  async get(name: string): Promise<Dataset | null> {
    const hit = this.cache.get(name);
    if (hit) return hit;
    const ds = await readJson<Dataset | null>(this.file(name), null);
    if (ds) this.cache.set(name, ds);
    return ds;
  }

  async list(): Promise<Dataset[]> {
    let files: string[] = [];
    try {
      files = (await readdir(this.dir)).filter((f) => f.endsWith('.json'));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    const all = await Promise.all(files.map((f) => this.get(decodeURIComponent(f.slice(0, -5)))));
    return all.filter((d): d is Dataset => d !== null).sort((a, b) => a.name.localeCompare(b.name));
  }

  async save(ds: Dataset): Promise<void> {
    await writeJsonAtomic(this.file(ds.name), ds);
    this.cache.set(ds.name, ds);
  }

  async remove(name: string): Promise<void> {
    await rm(this.file(name), { force: true });
    this.cache.delete(name);
  }
}

export const toMeta = (ds: Dataset): DatasetMeta => ({
  name: ds.name,
  columns: ds.columns,
  rowCount: ds.rows.length,
  syncedAt: ds.syncedAt,
});
