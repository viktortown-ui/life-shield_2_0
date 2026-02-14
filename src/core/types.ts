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
  name?: string;
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

export interface CashflowMonthlyEntry {
  ym: string;
  income: number;
  expense: number;
}

export interface CashflowDriftParams {
  delta: number;
  lambda: number;
  minN: number;
}

export interface CashflowDriftLastState {
  detected: boolean;
  score: number;
  ym: string | null;
  ts: string;
  paramsUsed: CashflowDriftParams;
}

export interface CashflowForecastLastState {
  ts: string;
  horizonMonths: number;
  paramsUsed: {
    iterations: number;
    seed?: number;
    sourceMonths: number;
    mode?: 'single' | 'ensemble';
  };
  probNetNegative: number;
  quantiles: {
    p10: number;
    p50: number;
    p90: number;
  };
  uncertainty: number;
  methodsUsed?: Array<'iid_bootstrap' | 'moving_block_bootstrap' | 'linear_trend_bootstrap'>;
  disagreementScore?: number;
  perMethodSummary?: Array<{
    method: 'iid_bootstrap' | 'moving_block_bootstrap' | 'linear_trend_bootstrap';
    probNetNegative: number;
    uncertainty: number;
    quantiles: {
      p10: number;
      p50: number;
      p90: number;
    };
  }>;
  monthly: Array<{
    month: number;
    p10: number;
    p50: number;
    p90: number;
  }>;
}

export interface ObservationsState {
  cashflowMonthly: CashflowMonthlyEntry[];
  cashflowDriftLast?: CashflowDriftLastState;
  cashflowForecastLast?: CashflowForecastLastState;
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
  mcLast?: StressMonteCarloResult | null;
  mcHistory?: StressMonteCarloHistoryEntry[];
}

export interface StressMonteCarloHistoryEntry {
  ts: string;
  horizonMonths: number;
  iterations: number;
  sigmaIncome: number;
  sigmaExpense: number;
  shock?: {
    enabled: boolean;
    probability: number;
    dropPercent: number;
  };
  ruinProb: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface StressMonteCarloHistogramBin {
  start: number;
  end: number;
  count: number;
}

export interface StressMonteCarloResult {
  horizonMonths: number;
  iterations: number;
  ruinProb: number;
  quantiles: {
    p10: number;
    p50: number;
    p90: number;
  };
  histogram: StressMonteCarloHistogramBin[];
  config: {
    horizonMonths: number;
    iterations: number;
    incomeVolatility: number;
    expensesVolatility: number;
    seed: number;
    shock: {
      enabled: boolean;
      probability: number;
      dropPercent: number;
    };
  };
}

export interface IslandRunHistoryEntry {
  at: string;
  score: number;
  confidence: number;
}

export type CosmosActivityAction = 'open' | 'data' | 'report' | 'confirm' | 'cancel';

export interface CosmosActivityEvent {
  ts: string;
  islandId: IslandId;
  action: CosmosActivityAction;
  meta?: string;
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
    homeScreen: 'shield' | 'cosmos';
    cosmosShowAllLabels: boolean;
    cosmosOnlyImportant: boolean;
    cosmosShowHalo: boolean;
    cosmosSoundFxEnabled: boolean;
    cosmosSfxVolume: number;
    cosmosReduceMotionOverride: boolean | null;
  };
  inputData: {
    finance: FinanceInputData;
  };
  observations: ObservationsState;
  cosmosActivityLog: CosmosActivityEvent[];
  islands: Record<IslandId, IslandState>;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}
