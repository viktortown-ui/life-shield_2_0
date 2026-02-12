import { describe, expect, it } from 'vitest';
import { getSnapshotReport } from './snapshot';

describe('snapshot calculations', () => {
  it('calculates runway, debt burden and coverage from finance input', () => {
    const report = getSnapshotReport(
      JSON.stringify({
        monthlyIncome: 200000,
        monthlyExpenses: 100000,
        reserveCash: 500000,
        monthlyDebtPayment: 20000,
        incomeSourcesCount: 3
      })
    );

    expect(report.score).toBeGreaterThan(70);
    expect(report.details[0]).toContain('5.0');
    expect(report.details[1]).toContain('10%');
    expect(report.details[2]).toContain('2.10');
  });

  it('caps score to 0-100 for stressed profile', () => {
    const report = getSnapshotReport(
      JSON.stringify({
        monthlyIncome: 70000,
        monthlyExpenses: 130000,
        reserveCash: 60000,
        monthlyDebtPayment: 40000,
        incomeSourcesCount: 1
      })
    );

    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });
});
