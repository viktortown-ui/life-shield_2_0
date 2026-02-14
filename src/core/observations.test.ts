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

  it('sanitizes cashflowForecastLast payload', () => {
    const result = sanitizeObservations({
      cashflowMonthly: [],
      cashflowForecastLast: {
        ts: '2026-01-01T00:00:00.000Z',
        horizonMonths: '6',
        paramsUsed: { iterations: '2000', sourceMonths: '12', seed: '77', mode: 'ensemble' },
        probNetNegative: 5,
        quantiles: { p10: '1', p50: '2', p90: '3' },
        uncertainty: '10',
        methodsUsed: ['iid_bootstrap', 'moving_block_bootstrap', 'bad'],
        disagreementScore: '0.45',
        perMethodSummary: [{ method: 'iid_bootstrap', probNetNegative: 2, uncertainty: '3', quantiles: { p10: '1', p50: '2', p90: '3' } }],
        monthly: [{ month: '1', p10: '1', p50: '2', p90: '3' }]
      }
    });

    expect(result.cashflowForecastLast?.horizonMonths).toBe(6);
    expect(result.cashflowForecastLast?.probNetNegative).toBe(1);
    expect(result.cashflowForecastLast?.paramsUsed.seed).toBe(77);
    expect(result.cashflowForecastLast?.paramsUsed.mode).toBe('ensemble');
    expect(result.cashflowForecastLast?.methodsUsed).toEqual(['iid_bootstrap', 'moving_block_bootstrap']);
    expect(result.cashflowForecastLast?.disagreementScore).toBe(0.45);
    expect(result.cashflowForecastLast?.perMethodSummary?.[0]?.probNetNegative).toBe(1);
    expect(result.cashflowForecastLast?.monthly[0]?.month).toBe(1);
  });

});
