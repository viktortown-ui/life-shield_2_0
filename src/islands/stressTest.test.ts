import { describe, expect, it } from 'vitest';
import { getStressTestReport } from './stressTest';

describe('stressTest calculations', () => {
  it('builds playable state, reasons and next steps', () => {
    const report = getStressTestReport(
      JSON.stringify({
        monthlyIncome: 210000,
        monthlyExpenses: 140000,
        reserveCash: 420000,
        monthlyDebtPayment: 30000,
        incomeSourcesCount: 2
      })
    );

    expect(report.details.length).toBeGreaterThanOrEqual(3);
    expect(report.reasons?.length ?? 0).toBeGreaterThan(0);
    expect(report.details.some((line) => line.includes('Если доход -30%'))).toBe(true);
    expect(report.details.some((line) => line.includes('Если расходы +20%'))).toBe(true);
    expect(report.actions?.length ?? 0).toBeGreaterThan(0);
  });
});
