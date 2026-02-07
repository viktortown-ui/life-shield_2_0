export type IslandId =
  | 'bayes'
  | 'hmm'
  | 'timeseries'
  | 'optimization'
  | 'decisionTree'
  | 'causalDag';

export interface IslandReport {
  id: IslandId;
  score: number;
  confidence: number;
  headline: string;
  summary: string;
  details: string[];
}

export interface IslandState {
  input: string;
  lastReport: IslandReport | null;
}

export interface AppState {
  schemaVersion: number;
  updatedAt: string;
  islands: Record<IslandId, IslandState>;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}
