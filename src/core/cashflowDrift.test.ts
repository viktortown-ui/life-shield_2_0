import { describe, expect, it } from 'vitest';
import {
  buildCashflowDriftLast,
  buildNetCashflowSeries,
  detectCashflowRegimeShift
} from './cashflowDrift';

describe('cashflow regime shift detector', () => {
  it('returns no drift for stable net series', () => {
    const points = buildNetCashflowSeries(
      Array.from({ length: 12 }, (_, index) => ({
        ym: `2025-${String(index + 1).padStart(2, '0')}`,
        income: 100000 + (index % 2) * 2000,
        expense: 70000 + (index % 2) * 2000
      }))
    );

    const result = detectCashflowRegimeShift(points);
    expect(result.driftDetected).toBe(false);
    expect(result.driftScore).toBeLessThan(1);
  });

  it('detects drift for step-like change in net', () => {
    const points = buildNetCashflowSeries([
      { ym: '2025-01', income: 100000, expense: 70000 },
      { ym: '2025-02', income: 99000, expense: 70000 },
      { ym: '2025-03', income: 101000, expense: 70000 },
      { ym: '2025-04', income: 100500, expense: 70000 },
      { ym: '2025-05', income: 100300, expense: 70000 },
      { ym: '2025-06', income: 145000, expense: 72000 },
      { ym: '2025-07', income: 150000, expense: 72000 },
      { ym: '2025-08', income: 152000, expense: 73000 },
      { ym: '2025-09', income: 151000, expense: 72500 },
      { ym: '2025-10', income: 153000, expense: 73000 }
    ]);

    const result = detectCashflowRegimeShift(points);
    expect(result.driftDetected).toBe(true);
    expect(result.driftYm).toBeTruthy();
    expect(result.driftScore).toBeGreaterThan(0.5);
  });

  it('handles NaN, empty and minN edge cases', () => {
    const raw = buildNetCashflowSeries([
      { ym: '2025-01', income: Number.NaN, expense: 10000 },
      { ym: '2025-02', income: 20000, expense: Number.NaN }
    ]);
    const short = detectCashflowRegimeShift(raw, { delta: 0.03, lambda: 4.2, minN: 6 });
    expect(short).toEqual({ driftDetected: false, driftYm: null, driftScore: 0 });

    const driftLast = buildCashflowDriftLast([]);
    expect(driftLast.detected).toBe(false);
    expect(driftLast.score).toBe(0);
  });
});
