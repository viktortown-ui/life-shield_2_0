import { describe, expect, it } from 'vitest';
import { runCashflowForecast } from './cashflowForecast';

describe('runCashflowForecast', () => {
  it('is reproducible with fixed seed', () => {
    const netSeries = [10000, 12000, 9000, 11000, 15000, 8000, 7000, 13000];
    const first = runCashflowForecast({ netSeries, horizonMonths: 6, iterations: 3000, seed: 7 });
    const second = runCashflowForecast({ netSeries, horizonMonths: 6, iterations: 3000, seed: 7 });
    expect(first).toEqual(second);
  });

  it('throws when not enough data', () => {
    expect(() =>
      runCashflowForecast({ netSeries: [1, 2, 3, 4, 5], horizonMonths: 3, iterations: 1000, seed: 1 })
    ).toThrow('нужно >=6 месяцев');
  });

  it('handles NaN and zero values', () => {
    const result = runCashflowForecast({
      netSeries: [0, Number.NaN, 0, 0, 0, 0, 0, 0],
      horizonMonths: 12,
      iterations: 400,
      seed: 3
    });

    expect(result.quantiles.p10).toBe(0);
    expect(result.quantiles.p50).toBe(0);
    expect(result.quantiles.p90).toBe(0);
    expect(result.probNetNegative).toBe(0);
    expect(result.monthly).toHaveLength(12);
  });
});
