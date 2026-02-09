import { describe, expect, it } from 'vitest';
import { isMutedScriptErrorEntry, shouldShowFatalOverlay } from './diagnosticsOverlay';
import type { DiagnosticsEntry } from './diagnostics';

const buildEntry = (overrides: Partial<DiagnosticsEntry>): DiagnosticsEntry => ({
  id: 'entry-id',
  errorId: 'error-id',
  ts: '2024-01-01T00:00:00.000Z',
  kind: 'error',
  message: 'boom',
  rawType: 'Error',
  ...overrides
});

describe('shouldShowFatalOverlay', () => {
  it('shows overlay for errors', () => {
    expect(shouldShowFatalOverlay(buildEntry({ kind: 'error' }))).toBe(true);
  });

  it('skips overlay for service worker entries', () => {
    expect(
      shouldShowFatalOverlay(
        buildEntry({ kind: 'service_worker', message: 'sw', rawType: 'sw' })
      )
    ).toBe(false);
  });

  it('skips overlay for breadcrumbs', () => {
    expect(
      shouldShowFatalOverlay(
        buildEntry({ kind: 'breadcrumb', message: 'boot', rawType: 'breadcrumb' })
      )
    ).toBe(false);
  });

  it('skips overlay for muted script errors', () => {
    expect(
      shouldShowFatalOverlay(buildEntry({ kind: 'error', suspectedMuted: true }))
    ).toBe(false);
  });

  it('flags script error without location as muted', () => {
    const entry = buildEntry({ kind: 'error', message: 'Script error.' });
    expect(isMutedScriptErrorEntry(entry)).toBe(true);
    expect(shouldShowFatalOverlay(entry)).toBe(false);
  });

  it('allows script error with location to be fatal', () => {
    const entry = buildEntry({
      kind: 'error',
      message: 'Script error.',
      filename: 'https://example.com/assets/app.js',
      lineno: 10,
      colno: 4
    });
    expect(isMutedScriptErrorEntry(entry)).toBe(false);
    expect(shouldShowFatalOverlay(entry)).toBe(true);
  });
});
