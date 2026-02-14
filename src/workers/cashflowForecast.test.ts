import { describe, expect, it } from 'vitest';
import { calculateDisagreementScore, runCashflowForecast } from './cashflowForecast';

describe('runCashflowForecast', () => {
  const netSeries = [10000, 12000, 9000, 11000, 15000, 8000, 7000, 13000];

  it('is reproducible with fixed seed for single mode', () => {
    const first = runCashflowForecast({ netSeries, horizonMonths: 6, iterations: 3000, seed: 7, mode: 'single' });
    const second = runCashflowForecast({ netSeries, horizonMonths: 6, iterations: 3000, seed: 7, mode: 'single' });
    expect(first).toEqual(second);
    expect(first.methodsUsed).toEqual(['iid_bootstrap']);
  });

  it('is reproducible with fixed seed for ensemble mode', () => {
    const first = runCashflowForecast({ netSeries, horizonMonths: 6, iterations: 3000, seed: 7, mode: 'ensemble' });
    const second = runCashflowForecast({ netSeries, horizonMonths: 6, iterations: 3000, seed: 7, mode: 'ensemble' });
    expect(first).toEqual(second);
    expect(first.methodsUsed).toEqual(['iid_bootstrap', 'moving_block_bootstrap', 'linear_trend_bootstrap']);
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
      seed: 3,
      mode: 'ensemble'
    });

    expect(result.quantiles.p10).toBe(0);
    expect(result.quantiles.p50).toBe(0);
    expect(result.quantiles.p90).toBe(0);
    expect(result.probNetNegative).toBe(0);
    expect(result.monthly).toHaveLength(12);
  });
});

describe('calculateDisagreementScore', () => {
  it('is low for identical model medians', () => {
    expect(calculateDisagreementScore([100, 100, 100])).toBe(0);
  });

  it('is high for strongly diverging model medians', () => {
    expect(calculateDisagreementScore([-5000, 0, 9000])).toBeGreaterThan(0.9);
  });
});
