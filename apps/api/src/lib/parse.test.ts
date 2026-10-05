import { describe, expect, it } from 'vitest';
import { inferType, parseDate, parseNumber } from './parse.js';

describe('parseDate', () => {
  it('hiểu ISO và dd/mm/yyyy', () => {
    expect(parseDate('2026-09-05')).toBe('2026-09-05');
    expect(parseDate('05/09/2026')).toBe('2026-09-05');
    expect(parseDate('5/9/2026 14:30')).toBe('2026-09-05T14:30:00');
  });
  it('từ chối ngày không tồn tại và số thường', () => {
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('12345')).toBeNull();
  });
});

describe('parseNumber', () => {
  it('xử lý dấu phân cách nghìn / thập phân / ký hiệu', () => {
    expect(parseNumber('1,234.56')).toBe(1234.56);
    expect(parseNumber('1.234,56')).toBe(1234.56);
    expect(parseNumber('1,500,000')).toBe(1500000);
    expect(parseNumber('12%')).toBe(12);
    expect(parseNumber('abc')).toBeNull();
  });
});

describe('inferType', () => {
  it('number / date / string, bỏ qua ô trống', () => {
    expect(inferType(['1', '2', '', '3'])).toBe('number');
    expect(inferType(['01/09/2026', '02/09/2026'])).toBe('date');
    expect(inferType(['a', 'b', '1'])).toBe('string');
  });
});
