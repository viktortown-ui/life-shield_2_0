import { AppState } from './types';

export const schemaVersion = 5;

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
  })
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
