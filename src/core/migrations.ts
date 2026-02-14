import { AppState, CosmosActivityEvent } from './types';
import { sanitizeObservations } from './observations';
import { buildCashflowDriftLast } from './cashflowDrift';

export const schemaVersion = 10;

export type Migration = (state: AppState) => AppState;

export const migrations: Migration[] = [
  (state) => ({ ...state, schemaVersion: 1 }),
  (state) => ({
    ...state,
    schemaVersion: 2,
    xp: state.xp ?? 0,
    level: state.level ?? 1,
    streakDays: state.streakDays ?? 0,
    islands: Object.fromEntries(
      Object.entries(state.islands).map(([key, island]) => [
        key,
        {
          ...island,
          progress: island.progress ?? {
            lastRunAt: null,
            runsCount: 0,
            bestScore: 0,
            history: []
          }
        }
      ])
    )
  }),
  (state) => ({
    ...state,
    schemaVersion: 3,
    flags: {
      onboarded: state.flags?.onboarded ?? false,
      demoLoaded: state.flags?.demoLoaded ?? false
    }
  }),
  (state) => ({
    ...state,
    schemaVersion: 4,
    islands: Object.fromEntries(
      Object.entries(state.islands).map(([key, island]) => [
        key,
        {
          ...island,
          progress: {
            ...island.progress,
            history: Array.isArray(island.progress?.history)
              ? island.progress.history
              : []
          }
        }
      ])
    )
  }),
  (state) => ({
    ...state,
    schemaVersion: 5,
    inputData: {
      finance: {
        monthlyIncome: state.inputData?.finance?.monthlyIncome ?? 180000,
        monthlyExpenses: state.inputData?.finance?.monthlyExpenses ?? 120000,
        reserveCash: state.inputData?.finance?.reserveCash ?? 360000,
        monthlyDebtPayment: state.inputData?.finance?.monthlyDebtPayment ?? 25000,
        incomeSourcesCount: state.inputData?.finance?.incomeSourcesCount ?? 1,
        top1Share: state.inputData?.finance?.top1Share ?? 0.8,
        top3Share: state.inputData?.finance?.top3Share ?? 1
      }
    }
  }),
  (state) => ({
    ...state,
    schemaVersion: 6,
    flags: {
      ...state.flags,
      homeScreen: state.flags?.homeScreen === 'cosmos' ? 'cosmos' : 'shield'
    }
  }),
  (state) => ({
    ...state,
    schemaVersion: 7,
    flags: {
      ...state.flags,
      cosmosSoundFxEnabled: state.flags?.cosmosSoundFxEnabled ?? false,
      cosmosSfxVolume: Number.isFinite(state.flags?.cosmosSfxVolume)
        ? Math.max(0, Math.min(1, Number(state.flags?.cosmosSfxVolume)))
        : 0.4,
      cosmosReduceMotionOverride:
        state.flags?.cosmosReduceMotionOverride === null || typeof state.flags?.cosmosReduceMotionOverride === 'boolean'
          ? state.flags.cosmosReduceMotionOverride
          : null
    }
  }),
  (state) => ({
    ...state,
    schemaVersion: 8,
    cosmosActivityLog: Array.isArray((state as { cosmosActivityLog?: CosmosActivityEvent[] }).cosmosActivityLog)
      ? ((state as { cosmosActivityLog?: CosmosActivityEvent[] }).cosmosActivityLog as CosmosActivityEvent[]).slice(-200)
      : []
  }),
  (state) => ({
    ...state,
    schemaVersion: 9,
    observations: sanitizeObservations((state as { observations?: unknown }).observations)
  }),
  (state) => {
    const observations = sanitizeObservations((state as { observations?: unknown }).observations);
    return {
      ...state,
      schemaVersion: 10,
      observations: {
        ...observations,
        cashflowDriftLast: buildCashflowDriftLast(observations.cashflowMonthly)
      }
    };
  }
];

export const migrate = (state: AppState): AppState => {
  if (state.schemaVersion >= schemaVersion) {
    return state;
  }

  let nextState = { ...state };
  for (let index = state.schemaVersion; index < schemaVersion; index += 1) {
    const migration = migrations[index];
    if (!migration) continue;
    nextState = migration(nextState);
  }

  return { ...nextState, schemaVersion };
};
