import type { DiagnosticsEntry } from './diagnostics';

export const shouldShowFatalOverlay = (entry: DiagnosticsEntry): boolean => {
  if (entry.kind === 'error') {
    return !entry.suspectedMuted;
  }
  return entry.kind === 'rejection';
};
