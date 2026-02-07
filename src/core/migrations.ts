import { AppState } from './types';

export const schemaVersion = 2;

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
            bestScore: 0
          }
        }
      ])
    )
  })
];

export const migrate = (state: AppState): AppState => {
  if (state.schemaVersion >= schemaVersion) {
    return state;
  }

  let nextState = { ...state };
  for (const migration of migrations) {
    nextState = migration(nextState);
  }

  return { ...nextState, schemaVersion };
};
