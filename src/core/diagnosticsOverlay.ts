import type { DiagnosticsEntry } from './diagnostics';

export const shouldShowFatalOverlay = (entry: DiagnosticsEntry): boolean => {
  return entry.kind === 'error' || entry.kind === 'rejection';
};
