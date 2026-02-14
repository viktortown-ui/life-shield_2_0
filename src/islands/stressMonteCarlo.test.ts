import { describe, expect, it } from 'vitest';
import {
  getDeterministicRunwayMonths,
  runMonteCarloRunway
} from './stressMonteCarlo';

describe('stress monte carlo runway', () => {
  it('is reproducible with fixed seed', () => {
    const finance = {
      monthlyIncome: 180000,
      monthlyExpenses: 150000,
      reserveCash: 300000,
      monthlyDebtPayment: 20000,
      incomeSourcesCount: 2
    };

    const input = {
      horizonMonths: 6,
      iterations: 4000,
      incomeVolatility: 15,
      expensesVolatility: 8,
      seed: 123456,
      shock: {
        enabled: true,
        probability: 0.1,
        dropPercent: 30
      }
    };

    const first = runMonteCarloRunway(finance, input);
    const second = runMonteCarloRunway(finance, input);

    expect(first.quantiles.p10).toBeCloseTo(second.quantiles.p10, 5);
    expect(first.quantiles.p50).toBeCloseTo(second.quantiles.p50, 5);
    expect(first.quantiles.p90).toBeCloseTo(second.quantiles.p90, 5);
    expect(first.ruinProb).toBeCloseTo(second.ruinProb, 5);
  });

  it('matches deterministic runway when sigma is zero', () => {
    const finance = {
      monthlyIncome: 100000,
      monthlyExpenses: 150000,
      reserveCash: 120000,
      monthlyDebtPayment: 0,
      incomeSourcesCount: 1
    };

    const horizonMonths = 12;
    const deterministic = getDeterministicRunwayMonths({
      reserveCash: finance.reserveCash,
      monthlyIncome: finance.monthlyIncome,
      monthlyExpenses: finance.monthlyExpenses,
      horizonMonths
    });

    const mc = runMonteCarloRunway(finance, {
      horizonMonths,
      iterations: 3000,
      incomeVolatility: 0,
      expensesVolatility: 0,
      seed: 7,
      shock: {
        enabled: false,
        probability: 0,
        dropPercent: 0
      }
    });

    expect(mc.quantiles.p10).toBeCloseTo(deterministic, 5);
    expect(mc.quantiles.p50).toBeCloseTo(deterministic, 5);
    expect(mc.quantiles.p90).toBeCloseTo(deterministic, 5);
  });
});
