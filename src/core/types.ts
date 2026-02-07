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
  actions?: ActionItem[];
  insights?: Insight[];
}

export interface ActionItem {
  title: string;
  impact: number;
  effort: number;
  description?: string;
}

export interface Insight {
  title: string;
  severity: 'info' | 'warning' | 'risk';
}

export interface Quest {
  title: string;
  why: string;
  action: string;
  rewardXp: number;
  sourceId: IslandId;
}

export interface GlobalVerdict {
  globalScore: number;
  chaos: number;
  rank: 'S' | 'A' | 'B' | 'C' | 'D';
  mood: 'штиль' | 'напряжение' | 'шторм';
  quests: Quest[];
}

export interface IslandState {
  input: string;
  lastReport: IslandReport | null;
  progress: IslandProgress;
}

export interface IslandProgress {
  lastRunAt: string | null;
  runsCount: number;
  bestScore: number;
}

export interface AppState {
  schemaVersion: number;
  updatedAt: string;
  xp: number;
  level: number;
  streakDays: number;
  islands: Record<IslandId, IslandState>;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}
