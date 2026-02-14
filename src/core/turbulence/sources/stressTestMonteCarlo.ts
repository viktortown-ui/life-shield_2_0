import { AppState, StressMonteCarloHistoryEntry, StressMonteCarloResult } from '../../types';
import { TurbulenceSignal } from '../types';
import { clamp01, normalizeRatio } from '../utils';

const MC_RUIN_WEIGHT = 0.6;
const MC_UNCERTAINTY_WEIGHT = 0.25;
const MC_DRIFT_WEIGHT = 0.15;
const DRIFT_MIN_N = 8;
const DRIFT_DELTA = 0.003;
const DRIFT_LAMBDA = 0.08;

const getUncertainty = (quantiles: StressMonteCarloResult['quantiles']) => {
  const spread = quantiles.p90 - quantiles.p10;
  return clamp01(spread / Math.max(1, quantiles.p50));
};

const detectRiskRegimeShift = (history: StressMonteCarloHistoryEntry[]) => {
  if (history.length < DRIFT_MIN_N) {
    return { driftDetected: false, driftTs: null as string | null, driftScore: 0 };
  }

  const series = history.map((entry) => normalizeRatio(entry.ruinProb));
  let mean = series[0] ?? 0;
  let cum = 0;
  let minCum = 0;
  let maxExcess = 0;
  let driftTs: string | null = null;

  for (let index = 1; index < series.length; index += 1) {
    const value = series[index] ?? 0;
    mean = mean + (value - mean) / (index + 1);
    cum += value - mean - DRIFT_DELTA;
    minCum = Math.min(minCum, cum);
    const excess = cum - minCum;
    if (excess > maxExcess) {
      maxExcess = excess;
    }
    if (excess > DRIFT_LAMBDA) {
      driftTs = history[index]?.ts ?? null;
    }
  }

  return {
    driftDetected: driftTs !== null,
    driftTs,
    driftScore: clamp01(maxExcess / DRIFT_LAMBDA)
  };
};

export const getStressTestMonteCarloSignal = (state: AppState): TurbulenceSignal | null => {
  const mc = state.islands.stressTest.mcLast;
  if (!mc) return null;

  const ruin = normalizeRatio(mc.ruinProb);
  const uncertainty = getUncertainty(mc.quantiles);
  const drift = detectRiskRegimeShift(state.islands.stressTest.mcHistory ?? []);

  const score = clamp01(ruin * MC_RUIN_WEIGHT + uncertainty * MC_UNCERTAINTY_WEIGHT + drift.driftScore * MC_DRIFT_WEIGHT);
  const confidence = clamp01(Math.min(1, mc.iterations / 2000) * 0.6 + Math.min(1, (state.islands.stressTest.mcHistory?.length ?? 0) / 12) * 0.4);

  return {
    id: 'stressTestMonteCarlo',
    label: 'Stress Monte Carlo',
    score,
    confidence,
    ts: state.islands.stressTest.mcHistory?.at(-1)?.ts,
    explanation: `Риск провала ${(ruin * 100).toFixed(1)}%, неопределённость ${(uncertainty * 100).toFixed(0)}%.`,
    evidence: {
      ruinProb: mc.ruinProb,
      p10: mc.quantiles.p10,
      p50: mc.quantiles.p50,
      p90: mc.quantiles.p90,
      uncertainty,
      driftScore: drift.driftScore,
      driftDetected: drift.driftDetected,
      driftTs: drift.driftTs
    }
  };
};
