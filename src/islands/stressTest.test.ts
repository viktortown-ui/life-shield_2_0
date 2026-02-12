import { describe, expect, it } from 'vitest';
import { getStressTestReport } from './stressTest';

describe('stressTest calculations', () => {
  it('builds what-if scenarios and risk zones', () => {
    const report = getStressTestReport(
      JSON.stringify({
        monthlyIncome: 210000,
        monthlyExpenses: 140000,
        reserveCash: 420000,
        monthlyDebtPayment: 30000,
        incomeSourcesCount: 2
      })
    );

    expect(report.details).toHaveLength(3);
    expect(report.details[0]).toContain('Если доход -30%');
    expect(report.details[2]).toContain('Если расходы +20%');
    expect(report.actions?.length ?? 0).toBeGreaterThan(0);
  });
});
