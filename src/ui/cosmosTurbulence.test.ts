import { describe, expect, it } from 'vitest';
import { getTurbulenceScore } from './cosmosTurbulence';

describe('getTurbulenceScore', () => {
  it('uses only uncertainty when ruin is zero', () => {
    const result = getTurbulenceScore({
      horizonMonths: 12,
      iterations: 1000,
      ruinProb: 0,
      quantiles: { p10: 2, p50: 10, p90: 8 },
      histogram: [],
      config: {
        horizonMonths: 12,
        iterations: 1000,
        incomeVolatility: 0.1,
        expensesVolatility: 0.1,
        seed: 1,
        shock: { enabled: false, probability: 0, dropPercent: 0 }
      }
    });

    expect(result).not.toBeNull();
    expect(result?.uncertainty).toBeCloseTo(0.6);
    expect(result?.turbulence).toBeCloseTo(0.18);
  });

  it('uses only ruin part when uncertainty is zero', () => {
    const result = getTurbulenceScore({
      horizonMonths: 12,
      iterations: 1000,
      ruinProb: 40,
      quantiles: { p10: 5, p50: 10, p90: 5 },
      histogram: [],
      config: {
        horizonMonths: 12,
        iterations: 1000,
        incomeVolatility: 0.1,
        expensesVolatility: 0.1,
        seed: 1,
        shock: { enabled: false, probability: 0, dropPercent: 0 }
      }
    });

    expect(result).not.toBeNull();
    expect(result?.uncertainty).toBe(0);
    expect(result?.turbulence).toBeCloseTo(0.28);
  });

  it('clamps edge values and avoids NaN/Infinity', () => {
    const result = getTurbulenceScore({
      horizonMonths: 12,
      iterations: 1000,
      ruinProb: Infinity,
      quantiles: { p10: Number.NaN, p50: 0, p90: Infinity },
      histogram: [],
      config: {
        horizonMonths: 12,
        iterations: 1000,
        incomeVolatility: 0.1,
        expensesVolatility: 0.1,
        seed: 1,
        shock: { enabled: false, probability: 0, dropPercent: 0 }
      }
    });

    expect(result).not.toBeNull();
    expect(result?.ruin).toBe(0);
    expect(result?.uncertainty).toBe(0);
    expect(result?.turbulence).toBe(0);
  });
});
