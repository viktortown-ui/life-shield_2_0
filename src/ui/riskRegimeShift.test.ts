import { describe, expect, it } from 'vitest';
import { detectRiskRegimeShift } from './riskRegimeShift';

const makeTs = (index: number) => `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`;

describe('detectRiskRegimeShift', () => {
  it('returns no drift for stable series', () => {
    const series = [0.05, 0.048, 0.052, 0.051, 0.049, 0.05, 0.051, 0.05, 0.049, 0.05];
    const result = detectRiskRegimeShift(series, series.map((_, idx) => makeTs(idx)));

    expect(result.driftDetected).toBe(false);
    expect(result.driftScore).toBeLessThan(1);
  });

  it('detects drift for step-up series', () => {
    const series = [0.05, 0.052, 0.051, 0.049, 0.05, 0.06, 0.25, 0.27, 0.26, 0.28, 0.29, 0.3];
    const timestamps = series.map((_, idx) => makeTs(idx));
    const result = detectRiskRegimeShift(series, timestamps);

    expect(result.driftDetected).toBe(true);
    expect(result.driftTs).toBeTruthy();
    expect(result.driftScore).toBeGreaterThan(0.99);
  });
});
