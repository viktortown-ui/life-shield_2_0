import { CashflowMonthlyEntry, CashflowDriftLastState } from './types';

export interface CashflowRegimeShiftConfig {
  delta: number;
  lambda: number;
  minN: number;
}

export interface NetCashflowPoint {
  ym: string;
  net: number;
}

export interface CashflowRegimeShiftResult {
  driftDetected: boolean;
  driftYm: string | null;
  driftScore: number;
}

export const DEFAULT_CASHFLOW_REGIME_SHIFT_CONFIG: CashflowRegimeShiftConfig = {
  delta: 0.03,
  lambda: 4.2,
  minN: 8
};

const clamp01 = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
};

const toFinite = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeSeries = (values: number[]) => {
  const mean = values.reduce((acc, value) => acc + value, 0) / Math.max(1, values.length);
  const variance =
    values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / Math.max(1, values.length);
  const std = Math.sqrt(variance);
  const scale = std > 1e-6 ? std : 1;
  return values.map((value) => (value - mean) / scale);
};

export const buildNetCashflowSeries = (
  rows: CashflowMonthlyEntry[],
  limit = 36
): NetCashflowPoint[] => {
  const sorted = [...rows].sort((a, b) => a.ym.localeCompare(b.ym));
  const capped = sorted.slice(-Math.max(1, Math.floor(limit)));
  return capped.map((row) => ({
    ym: row.ym,
    net: toFinite(row.income) - toFinite(row.expense)
  }));
};

export const detectCashflowRegimeShift = (
  points: NetCashflowPoint[],
  config: CashflowRegimeShiftConfig = DEFAULT_CASHFLOW_REGIME_SHIFT_CONFIG
): CashflowRegimeShiftResult => {
  const minN = Math.max(2, Math.floor(config.minN));
  if (points.length < minN) {
    return { driftDetected: false, driftYm: null, driftScore: 0 };
  }

  const normalized = normalizeSeries(points.map((point) => toFinite(point.net)));

  let mean = normalized[0] ?? 0;
  let cumulative = 0;
  let minCumulative = 0;
  let maxExcess = 0;
  let driftYm: string | null = null;

  for (let index = 1; index < normalized.length; index += 1) {
    const value = normalized[index] ?? 0;
    mean = mean + (value - mean) / (index + 1);
    cumulative += value - mean - config.delta;
    minCumulative = Math.min(minCumulative, cumulative);
    const excess = cumulative - minCumulative;

    if (excess > maxExcess) {
      maxExcess = excess;
    }

    if (excess > config.lambda) {
      driftYm = points[index]?.ym ?? null;
    }
  }

  return {
    driftDetected: driftYm !== null,
    driftYm,
    driftScore: clamp01(maxExcess / config.lambda)
  };
};

export const buildCashflowDriftLast = (
  rows: CashflowMonthlyEntry[],
  computedAt = new Date().toISOString(),
  config: CashflowRegimeShiftConfig = DEFAULT_CASHFLOW_REGIME_SHIFT_CONFIG
): CashflowDriftLastState => {
  const netSeries = buildNetCashflowSeries(rows);
  const drift = detectCashflowRegimeShift(netSeries, config);
  return {
    detected: drift.driftDetected,
    score: drift.driftScore,
    ym: drift.driftYm,
    ts: computedAt,
    paramsUsed: {
      delta: config.delta,
      lambda: config.lambda,
      minN: config.minN
    }
  };
};
