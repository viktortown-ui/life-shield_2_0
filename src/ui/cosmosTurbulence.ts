import { StressMonteCarloResult } from '../core/types';

export const MC_RISK_BADGE_THRESHOLD = 0.2;
const TURBULENCE_RUIN_WEIGHT = 0.7;
const TURBULENCE_UNCERTAINTY_WEIGHT = 0.3;

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

export const getTurbulenceScore = (mcLast: StressMonteCarloResult | null | undefined) => {
  if (!mcLast) return null;
  const ruin = normalizeRuinProb(mcLast.ruinProb);
  const uncertainty = getUncertaintyScore(mcLast.quantiles);
  const turbulence = clamp01(ruin * TURBULENCE_RUIN_WEIGHT + uncertainty * TURBULENCE_UNCERTAINTY_WEIGHT);

  return {
    ruin,
    uncertainty,
    turbulence,
    hasRiskBadge: ruin >= MC_RISK_BADGE_THRESHOLD
  };
};

export const getUncertaintyLabel = (uncertainty: number) => {
  if (uncertainty < 0.3) return 'низкая';
  if (uncertainty < 0.6) return 'средняя';
  return 'высокая';
};
