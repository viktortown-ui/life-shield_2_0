export const TURBULENCE_SOURCE_WEIGHTS = {
  stressTestMonteCarlo: 0.4,
  cashflowForecast: 0.3,
  cashflowDrift: 0.2,
  freshness: 0.1
} as const;

export type TurbulenceSourceId = keyof typeof TURBULENCE_SOURCE_WEIGHTS;
