import { safeGetItem } from './storage';

const DEBUG_QUERY_PARAM = 'debug';
const DEBUG_STORAGE_KEY = 'ls_debug';

const isEnabledFlag = (value: string | null): boolean => value?.trim() === '1';

const hasDebugInHash = (): boolean => {
  const hash = window.location.hash || '';
  if (!hash.includes('debug=')) return false;
  const [, queryLike = ''] = hash.split('?');
  if (!queryLike) return false;
  return isEnabledFlag(new URLSearchParams(queryLike).get(DEBUG_QUERY_PARAM));
};

export const isDebugEnabled = (): boolean => {
  try {
    if (
      isEnabledFlag(
        new URLSearchParams(window.location.search).get(DEBUG_QUERY_PARAM)
      )
    ) {
      return true;
    }
    if (hasDebugInHash()) {
      return true;
    }
  } catch {
    // ignore malformed URL cases
  }

  return isEnabledFlag(safeGetItem(DEBUG_STORAGE_KEY));
};
