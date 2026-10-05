import type { CellValue, ColumnType } from '@dashboard/shared';

const ISO = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const DMY = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const pad = (n: number | string) => String(n).padStart(2, '0');

/** Trả về 'YYYY-MM-DD' hoặc 'YYYY-MM-DDTHH:mm:ss'; chuỗi không phải ngày => null. Dạng a/b/yyyy hiểu là dd/mm/yyyy. */
export function parseDate(input: string): string | null {
  const s = input.trim();
  let y: number, m: number, d: number, rest: (string | undefined)[];
  let match = ISO.exec(s);
  if (match) {
    [y, m, d] = [+match[1]!, +match[2]!, +match[3]!];
    rest = match.slice(4);
  } else if ((match = DMY.exec(s))) {
    [d, m, y] = [+match[1]!, +match[2]!, +match[3]!];
    rest = match.slice(4);
  } else return null;

  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  const date = `${y}-${pad(m)}-${pad(d)}`;
  if (rest[0] === undefined) return date;
  const [hh, mm, ss] = [+rest[0], +rest[1]!, +(rest[2] ?? 0)];
  if (hh > 23 || mm > 59 || ss > 59) return null;
  return `${date}T${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

/** Hiểu "1,234.56", "12%", "$1,200", "-5". Không hiểu => null. */
export function parseNumber(input: string): number | null {
  let s = input.trim().replace(/[\s$€£₫đ%]|vnd/gi, '');
  if (!s || !/^[-+]?[\d.,]+$/.test(s)) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    // cả hai: ký tự đứng sau cùng là dấu thập phân
    s = lastDot > lastComma ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  } else if (lastComma !== -1) {
    s = /^[-+]?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Cột là number/date nếu >= 90% ô có giá trị parse được; ngược lại là string. */
export function inferType(values: string[], threshold = 0.9): ColumnType {
  const filled = values.filter((v) => v.trim() !== '');
  if (filled.length === 0) return 'string';
  const ratio = (fn: (v: string) => unknown) => filled.filter((v) => fn(v) !== null).length / filled.length;
  if (ratio(parseDate) >= threshold) return 'date';
  if (ratio(parseNumber) >= threshold) return 'number';
  return 'string';
}

/** Trả về giá trị đã ép kiểu, `bad` = true nếu ô có nội dung nhưng không ép được. */
export function coerce(raw: string, type: ColumnType): { value: CellValue; bad: boolean } {
  const s = raw.trim();
  if (s === '') return { value: null, bad: false };
  if (type === 'string') return { value: s, bad: false };
  const v = type === 'number' ? parseNumber(s) : parseDate(s);
  return v === null ? { value: null, bad: true } : { value: v, bad: false };
}
