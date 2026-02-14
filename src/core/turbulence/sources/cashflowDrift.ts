import { AppState } from '../../types';
import { TurbulenceSignal } from '../types';
import { clamp01 } from '../utils';

export const getCashflowDriftSignal = (state: AppState): TurbulenceSignal | null => {
  const drift = state.observations.cashflowDriftLast;
  if (!drift) return null;

  const rowCount = state.observations.cashflowMonthly.length;
  const confidence = clamp01(Math.min(1, rowCount / 12));

  return {
    id: 'cashflowDrift',
    label: 'Cashflow drift',
    score: clamp01(drift.score),
    confidence,
    ts: drift.ts,
    ym: drift.ym ?? undefined,
    explanation: drift.detected
      ? `Обнаружена смена режима net cashflow (${Math.round(drift.score * 100)}%).`
      : `Явной смены режима нет (${Math.round(drift.score * 100)}%).`,
    evidence: {
      driftScore: drift.score,
      driftDetected: drift.detected,
      ym: drift.ym
    }
  };
};
