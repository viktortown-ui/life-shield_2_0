import { AppState } from '../../types';
import { TurbulenceSignal } from '../types';
import { clamp01 } from '../utils';

const STALE_AFTER_DAYS = 14;

export const getFreshnessSignal = (state: AppState): TurbulenceSignal | null => {
  const timestamps: string[] = [];

  for (const islandState of Object.values(state.islands)) {
    if (islandState.progress.lastRunAt) {
      timestamps.push(islandState.progress.lastRunAt);
    }
  }
  if (state.observations.cashflowForecastLast?.ts) {
    timestamps.push(state.observations.cashflowForecastLast.ts);
  }

  const latestTs = timestamps
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];

  if (!latestTs) return null;

  const ageDays = (Date.now() - latestTs) / (1000 * 60 * 60 * 24);
  const score = clamp01(ageDays / STALE_AFTER_DAYS);

  return {
    id: 'freshness',
    label: 'Data freshness',
    score,
    confidence: 1,
    ts: new Date(latestTs).toISOString(),
    explanation: score > 0.5 ? 'Данные устаревают, обновите ключевые модули.' : 'Данные относительно свежие.',
    evidence: {
      ageDays: Number(ageDays.toFixed(1)),
      staleAfterDays: STALE_AFTER_DAYS
    }
  };
};
