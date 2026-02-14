import { describe, expect, it } from 'vitest';
import { sanitizeCashflowMonthly, sanitizeObservations } from './observations';

describe('sanitizeCashflowMonthly', () => {
  it('sanitizes numbers and defaults invalid/negative values to 0', () => {
    const rows = sanitizeCashflowMonthly([
      { ym: '2025-01', income: '100000', expense: -10 },
      { ym: '2025-02', income: Number.NaN, expense: undefined }
    ]);

    expect(rows).toEqual([
      { ym: '2025-01', income: 100000, expense: 0 },
      { ym: '2025-02', income: 0, expense: 0 }
    ]);
  });

  it('sorts by ym asc, deduplicates by month, and caps to last 36', () => {
    const source = Array.from({ length: 40 }, (_, index) => {
      const month = String((index % 12) + 1).padStart(2, '0');
      const year = 2022 + Math.floor(index / 12);
      return { ym: `${year}-${month}`, income: index, expense: 1 };
    });

    source.reverse();
    source.push({ ym: '2024-01', income: 999, expense: 2 });

    const rows = sanitizeCashflowMonthly(source);

    expect(rows).toHaveLength(36);
    expect(rows[0]?.ym).toBe('2022-05');
    expect(rows.at(-1)?.ym).toBe('2025-04');
    expect(rows.find((row) => row.ym === '2024-01')?.income).toBe(999);
  });

  it('drops invalid ym rows', () => {
    const rows = sanitizeCashflowMonthly([
      { ym: '2025-13', income: 1, expense: 1 },
      { ym: 'bad', income: 1, expense: 1 },
      { ym: '2025-03', income: 1, expense: 1 }
    ]);

    expect(rows).toEqual([{ ym: '2025-03', income: 1, expense: 1 }]);
  });

  it('sanitizes cashflowDriftLast payload', () => {
    const result = sanitizeObservations({
      cashflowMonthly: [],
      cashflowDriftLast: {
        detected: 1,
        score: 7,
        ym: '2025-02',
        ts: '2026-01-01T00:00:00.000Z',
        paramsUsed: { delta: 'bad', lambda: 10, minN: 1 }
      }
    });

    expect(result.cashflowDriftLast?.detected).toBe(true);
    expect(result.cashflowDriftLast?.score).toBe(1);
    expect(result.cashflowDriftLast?.paramsUsed.minN).toBe(2);
  });

});
