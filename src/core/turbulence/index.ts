import { AppState } from '../types';
import { TURBULENCE_SOURCE_WEIGHTS, TurbulenceSourceId } from './config';
import { getCashflowDriftSignal } from './sources/cashflowDrift';
import { getCashflowForecastSignal } from './sources/cashflowForecast';
import { getFreshnessSignal } from './sources/freshness';
import { getStressTestMonteCarloSignal } from './sources/stressTestMonteCarlo';
import { TurbulenceResult } from './types';
import { clamp01, normalizeWeights } from './utils';

const SIGNAL_GETTERS: Record<TurbulenceSourceId, (state: AppState) => TurbulenceResult['signals'][number] | null> = {
  stressTestMonteCarlo: getStressTestMonteCarloSignal,
  cashflowForecast: getCashflowForecastSignal,
  cashflowDrift: getCashflowDriftSignal,
  freshness: getFreshnessSignal
};

export const computeTurbulence = (state: AppState): TurbulenceResult => {
  const entries = (Object.keys(SIGNAL_GETTERS) as TurbulenceSourceId[])
    .map((id) => ({ id, signal: SIGNAL_GETTERS[id](state) }))
    .filter((entry): entry is { id: TurbulenceSourceId; signal: NonNullable<typeof entry.signal> } => Boolean(entry.signal));

  if (!entries.length) {
    return { overallScore: 0, overallConfidence: 0, signals: [] };
  }

  const normalized = normalizeWeights(
    TURBULENCE_SOURCE_WEIGHTS,
    entries.map((entry) => entry.id)
  );

  const signals = entries.map(({ id, signal }) => ({
    ...signal,
    configuredWeight: TURBULENCE_SOURCE_WEIGHTS[id],
    weight: normalized.get(id) ?? 0
  }));

  const overallScore = clamp01(
    signals.reduce((acc, signal) => acc + clamp01(signal.score) * signal.weight, 0)
  );
  const overallConfidence = clamp01(
    signals.reduce((acc, signal) => acc + clamp01(signal.confidence), 0) / signals.length
  );

  return {
    overallScore,
    overallConfidence,
    signals
  };
};

export * from './types';
export * from './config';
export { normalizeWeights } from './utils';
