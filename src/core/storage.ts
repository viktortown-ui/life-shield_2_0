import { reportCaughtError } from './reportError';

export const safeGetItem = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    reportCaughtError(error);
    console.warn('localStorage getItem failed:', error);
    return null;
  }
};

export const safeSetItem = (key: string, value: string): boolean => {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    reportCaughtError(error);
    console.warn('localStorage setItem failed:', error);
    return false;
  }
};

export const safeRemoveItem = (key: string): boolean => {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    reportCaughtError(error);
    console.warn('localStorage removeItem failed:', error);
    return false;
  }
};

export const safeClear = (): boolean => {
  try {
    window.localStorage.clear();
    return true;
  } catch (error) {
    reportCaughtError(error);
    console.warn('localStorage clear failed:', error);
    return false;
  }
};
