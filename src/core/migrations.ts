import { AppState } from './types';

export const schemaVersion = 1;

export type Migration = (state: AppState) => AppState;

export const migrations: Migration[] = [
  (state) => ({ ...state, schemaVersion: 1 })
];

export const migrateState = (state: AppState): AppState => {
  if (state.schemaVersion >= schemaVersion) {
    return state;
  }

  let nextState = { ...state };
  for (const migration of migrations) {
    nextState = migration(nextState);
  }

  return { ...nextState, schemaVersion };
};
