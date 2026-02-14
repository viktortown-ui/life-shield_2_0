import { StressMonteCarloHistoryEntry, StressMonteCarloResult } from '../core/types';
import { detectRiskRegimeShift } from './riskRegimeShift';

export const MC_RISK_BADGE_THRESHOLD = 0.2;
const TURBULENCE_RUIN_WEIGHT = 0.6;
const TURBULENCE_UNCERTAINTY_WEIGHT = 0.25;
const TURBULENCE_DRIFT_WEIGHT = 0.15;

const clamp01 = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
};

const normalizeRuinProb = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return value > 1 ? clamp01(value / 100) : clamp01(value);
};

export const getUncertaintyScore = (quantiles: StressMonteCarloResult['quantiles']) => {
  const spread = quantiles.p90 - quantiles.p10;
  return clamp01(spread / Math.max(1, quantiles.p50));
};

export const getTurbulenceScore = (
  mcLast: StressMonteCarloResult | null | undefined,
  mcHistory: StressMonteCarloHistoryEntry[] = []
) => {
  if (!mcLast) return null;
  const ruin = normalizeRuinProb(mcLast.ruinProb);
  const uncertainty = getUncertaintyScore(mcLast.quantiles);
  const drift = detectRiskRegimeShift(
    mcHistory.map((entry) => entry.ruinProb),
    mcHistory.map((entry) => entry.ts)
  );
  const turbulence = clamp01(
    ruin * TURBULENCE_RUIN_WEIGHT +
      uncertainty * TURBULENCE_UNCERTAINTY_WEIGHT +
      drift.driftScore * TURBULENCE_DRIFT_WEIGHT
  );

  return {
    ruin,
    uncertainty,
    drift: drift.driftScore,
    driftDetected: drift.driftDetected,
    driftTs: drift.driftTs,
    turbulence,
    hasRiskBadge: ruin >= MC_RISK_BADGE_THRESHOLD
  };
};

export const getUncertaintyLabel = (uncertainty: number) => {
  if (uncertainty < 0.3) return 'низкая';
  if (uncertainty < 0.6) return 'средняя';
  return 'высокая';
};
