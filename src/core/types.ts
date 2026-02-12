export type IslandId =
  | 'snapshot'
  | 'stressTest'
  | 'incomePortfolio'
  | 'bayes'
  | 'hmm'
  | 'timeseries'
  | 'optimization'
  | 'decisionTree'
  | 'causalDag';

export interface IncomeSource {
  amount: number;
  stability: number;
}

export interface FinanceInputData {
  monthlyIncome: number;
  monthlyExpenses: number;
  reserveCash: number;
  monthlyDebtPayment: number;
  incomeSourcesCount: number;
  top1Share?: number;
  top3Share?: number;
  incomeSources?: IncomeSource[];
}

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
  globalConfidence: number;
  chaos: number;
  rank: 'S' | 'A' | 'B' | 'C' | 'D';
  mood: 'штиль' | 'напряжение' | 'шторм';
  isHighRisk: boolean;
  isHighUncertainty: boolean;
  quests: Quest[];
}

export interface IslandState {
  input: string;
  lastReport: IslandReport | null;
  progress: IslandProgress;
}

export interface IslandRunHistoryEntry {
  at: string;
  score: number;
  confidence: number;
}

export interface IslandProgress {
  lastRunAt: string | null;
  runsCount: number;
  bestScore: number;
  history: IslandRunHistoryEntry[];
}

export interface AppState {
  schemaVersion: number;
  updatedAt: string;
  xp: number;
  level: number;
  streakDays: number;
  flags: {
    onboarded: boolean;
    demoLoaded: boolean;
  };
  inputData: {
    finance: FinanceInputData;
  };
  islands: Record<IslandId, IslandState>;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}
