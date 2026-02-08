const toError = (error: unknown) =>
  error instanceof Error ? error : new Error(String(error));

export const reportCaughtError = (error: unknown) => {
  if (typeof globalThis.reportError !== 'function') return;
  try {
    globalThis.reportError(toError(error));
  } catch {
    // ignore
  }
};
