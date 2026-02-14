export interface RegimeShiftDetectorConfig {
  delta: number;
  lambda: number;
  minN: number;
}

export interface RegimeShiftResult {
  driftDetected: boolean;
  driftTs: string | null;
  driftScore: number;
}

const clamp01 = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
};

export const DEFAULT_REGIME_SHIFT_CONFIG: RegimeShiftDetectorConfig = {
  delta: 0.003,
  lambda: 0.08,
  minN: 8
};

export const detectRiskRegimeShift = (
  series: number[],
  timestamps: string[],
  config: RegimeShiftDetectorConfig = DEFAULT_REGIME_SHIFT_CONFIG
): RegimeShiftResult => {
  const values = series.map((value) => clamp01(value > 1 ? value / 100 : value));
  if (values.length < config.minN) {
    return { driftDetected: false, driftTs: null, driftScore: 0 };
  }

  let mean = values[0] ?? 0;
  let cum = 0;
  let minCum = 0;
  let maxExcess = 0;
  let driftTs: string | null = null;

  for (let index = 1; index < values.length; index += 1) {
    const value = values[index] ?? 0;
    mean = mean + (value - mean) / (index + 1);
    cum += value - mean - config.delta;
    minCum = Math.min(minCum, cum);
    const excess = cum - minCum;
    if (excess > maxExcess) {
      maxExcess = excess;
    }
    if (excess > config.lambda) {
      driftTs = timestamps[index] ?? null;
    }
  }

  return {
    driftDetected: driftTs !== null,
    driftTs,
    driftScore: clamp01(maxExcess / config.lambda)
  };
};
