import { describe, expect, it } from 'vitest';
import { getIncomePortfolioReport } from './incomePortfolio';

describe('incomePortfolio calculations', () => {
  it('calculates HHI, topShare and concentration using source list', () => {
    const report = getIncomePortfolioReport(
      JSON.stringify({
        monthlyIncome: 210000,
        incomeSourcesCount: 3,
        incomeSources: [
          { amount: 150000, stability: 5 },
          { amount: 40000, stability: 4 },
          { amount: 20000, stability: 3 }
        ]
      })
    );

    expect(report.details[0]).toContain('HHI');
    expect(report.details[1]).toContain('Top share');
    expect(report.headline).toContain('концентрация');
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });
});
