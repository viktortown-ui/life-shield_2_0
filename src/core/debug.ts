import { safeGetItem } from './storage';

const DEBUG_QUERY_PARAM = 'debug';
const DEBUG_STORAGE_KEY = 'ls_debug';

const normalizeFlag = (value: string | null): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

export const isDebugEnabled = (): boolean => {
  try {
    const queryFlag = new URLSearchParams(window.location.search).get(
      DEBUG_QUERY_PARAM
    );
    if (normalizeFlag(queryFlag)) {
      return true;
    }
  } catch {
    // ignore malformed URL cases
  }

  return normalizeFlag(safeGetItem(DEBUG_STORAGE_KEY));
};

