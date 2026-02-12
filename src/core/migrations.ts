import { AppState } from './types';

export const schemaVersion = 3;

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
  }),
  (state) => ({
    ...state,
    schemaVersion: 3,
    flags: {
      onboarded: state.flags?.onboarded ?? false,
      demoLoaded: state.flags?.demoLoaded ?? false
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
