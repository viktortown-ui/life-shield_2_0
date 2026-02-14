export interface TurbulenceSignal {
  id: string;
  label: string;
  score: number;
  confidence: number;
  ts?: string;
  ym?: string;
  explanation: string;
  evidence?: Record<string, number | string | boolean | null | undefined>;
}

export interface WeightedTurbulenceSignal extends TurbulenceSignal {
  configuredWeight: number;
  weight: number;
}

export interface TurbulenceResult {
  overallScore: number;
  overallConfidence: number;
  signals: WeightedTurbulenceSignal[];
}
