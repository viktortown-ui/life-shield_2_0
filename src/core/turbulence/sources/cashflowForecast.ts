import { AppState } from '../../types';
import { TurbulenceSignal } from '../types';
import { clamp01 } from '../utils';

const PROB_WEIGHT = 0.6;
const UNCERTAINTY_WEIGHT = 0.25;
const DISAGREEMENT_WEIGHT = 0.15;

export const getCashflowForecastSignal = (state: AppState): TurbulenceSignal | null => {
  const forecast = state.observations.cashflowForecastLast;
  if (!forecast) return null;

  const disagreement = clamp01(forecast.disagreementScore ?? 0);
  const score = clamp01(
    clamp01(forecast.probNetNegative) * PROB_WEIGHT +
      clamp01(forecast.uncertainty) * UNCERTAINTY_WEIGHT +
      disagreement * DISAGREEMENT_WEIGHT
  );

  const hasEnsemble = (forecast.methodsUsed?.length ?? 0) >= 3;
  const confidence = clamp01(Math.min(1, forecast.paramsUsed.sourceMonths / 12) * 0.65 + (hasEnsemble ? 0.35 : 0.15));

  return {
    id: 'cashflowForecast',
    label: 'Cashflow forecast',
    score,
    confidence,
    ts: forecast.ts,
    explanation: `Вероятность отрицательного net ${(forecast.probNetNegative * 100).toFixed(1)}%, disagreement ${Math.round(
      disagreement * 100
    )}%.`,
    evidence: {
      probNetNegative: forecast.probNetNegative,
      uncertainty: forecast.uncertainty,
      disagreementScore: disagreement,
      p10: forecast.quantiles.p10,
      p50: forecast.quantiles.p50,
      p90: forecast.quantiles.p90
    }
  };
};
