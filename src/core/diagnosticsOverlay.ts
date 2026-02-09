import type { DiagnosticsEntry } from './diagnostics';

const isMutedScriptEntry = (entry: DiagnosticsEntry): boolean => {
  if (entry.suspectedMuted) return true;
  if (entry.message !== 'Script error.') return false;
  const hasLocation = Boolean(entry.filename);
  const hasLine = typeof entry.lineno === 'number' && entry.lineno > 0;
  const hasCol = typeof entry.colno === 'number' && entry.colno > 0;
  return !hasLocation || !hasLine || !hasCol;
};

export const isMutedScriptErrorEntry = (entry: DiagnosticsEntry): boolean =>
  entry.kind === 'error' && isMutedScriptEntry(entry);

export const shouldShowFatalOverlay = (entry: DiagnosticsEntry): boolean => {
  const fatalKinds = new Set<DiagnosticsEntry['kind']>([
    'error',
    'rejection',
    'resource',
    'blank_screen_detected',
    'console_error'
  ]);
  if (!fatalKinds.has(entry.kind)) {
    return false;
  }
  if (entry.kind === 'error' && isMutedScriptEntry(entry)) {
    return false;
  }
  return true;
};
