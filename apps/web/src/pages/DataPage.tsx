import type { DatasetMeta } from '@dashboard/shared';
import { useEffect, useState } from 'react';
import { useRecords } from '../api';
import { fmtCell, fmtFull } from '../format';

const PAGE_SIZE = 50;

export function DataPage({ meta }: { meta: DatasetMeta }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sort, setSort] = useState<string>('');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const q = useRecords(meta.name, { page, pageSize: PAGE_SIZE, search: debounced, sort, order });
  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleSort = (name: string) => {
    if (sort === name) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSort(name); setOrder('asc'); }
    setPage(1);
  };

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{meta.name}</h2>
          <p className="muted">{fmtFull(total)} dòng · sync lúc {new Date(meta.syncedAt).toLocaleString('vi-VN')}</p>
        </div>
        <label className="field inline"><span>Tìm kiếm</span><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nhập từ khoá…" /></label>
      </div>

      {q.error ? <p className="error">Không tải được: {q.error.message}</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {meta.columns.map((c) => (
                  <th key={c.name} className={c.type === 'number' ? 'num' : undefined} aria-sort={sort === c.name ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button className="th-btn" onClick={() => toggleSort(c.name)}>
                      {c.name} <span aria-hidden>{sort === c.name ? (order === 'asc' ? '↑' : '↓') : ''}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.data?.rows.map((r, i) => (
                <tr key={i}>{meta.columns.map((c) => <td key={c.name} className={c.type === 'number' ? 'num' : undefined}>{fmtCell(r[c.name] ?? null)}</td>)}</tr>
              ))}
              {q.data && q.data.rows.length === 0 && <tr><td colSpan={meta.columns.length} className="muted">Không có dòng nào.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <div className="pager">
        <button className="btn ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Trước</button>
        <span className="muted">Trang {page}/{pages}</span>
        <button className="btn ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau →</button>
      </div>
    </section>
  );
}
