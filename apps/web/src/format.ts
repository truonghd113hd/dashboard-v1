const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

export const fmtCompact = (n: number) => compact.format(n);
export const fmtFull = (n: number) => full.format(n);
export const fmtCell = (v: string | number | null) => (v === null ? '' : typeof v === 'number' ? fmtFull(v) : String(v));

export function fmtBucket(iso: string, groupBy: 'day' | 'week' | 'month') {
  const [y, m, d] = iso.split('-');
  return groupBy === 'month' ? `${m}/${y}` : `${d}/${m}`;
}

export const today = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
export const fmtDay = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
export function daysAgo(n: number, from = today()) {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
