// Sinh dataset mẫu "su_kien" (đăng ký sự kiện) để dev UI khi chưa nối Google Sheet.
import { loadConfig } from '../config.js';
import { buildDataset } from '../services/dataset-builder.js';
import { DatasetRepo } from '../store/dataset-repo.js';

const config = loadConfig();
const repo = new DatasetRepo(`${config.dataDir}/datasets`);

let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;

const channels = ['Facebook', 'Zalo', 'Email', 'Offline', 'Giới thiệu'];
const tickets = ['Standard', 'VIP', 'Early bird'];
const price: Record<string, number> = { Standard: 500000, VIP: 1500000, 'Early bird': 350000 };

const values: string[][] = [['Ngày', 'Họ tên', 'Kênh', 'Loại vé', 'Số vé', 'Doanh thu', 'Check-in']];
const start = Date.UTC(2026, 8, 1);
for (let i = 0; i < 400; i++) {
  const d = new Date(start + Math.floor(rnd() * 30) * 86400000);
  const t = pick(tickets);
  const qty = 1 + Math.floor(rnd() * 4);
  const dd = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
  values.push([dd, `Khách ${i + 1}`, pick(channels), t, String(qty), (price[t]! * qty).toLocaleString('en-US'), rnd() > 0.35 ? '1' : '0']);
}

const { dataset } = buildDataset('su_kien', values);
await repo.save(dataset);
console.log(`seeded "${dataset.name}": ${dataset.rows.length} rows, columns = ${dataset.columns.map((c) => `${c.name}:${c.type}`).join(', ')}`);
