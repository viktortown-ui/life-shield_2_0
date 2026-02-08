import { safeGetItem, safeSetItem } from './storage';

const DIAGNOSTICS_KEY = 'lifeShieldV2:diagnostics';
const MAX_ENTRIES = 50;

export type NormalizedError = {
  message: string;
  stack?: string;
  name?: string;
  rawType: string;
  jsonPreview?: string;
};

export type DiagnosticsEntry = {
  id: string;
  errorId: string;
  ts: string;
  kind: 'error' | 'rejection' | 'resource' | 'console' | 'overlay' | 'breadcrumb';
  message: string;
  stack?: string;
  name?: string;
  rawType: string;
  jsonPreview?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  source?: string;
  level?: 'warn' | 'error';
};

type DiagnosticsState = {
  entries: DiagnosticsEntry[];
  panel: HTMLDetailsElement | null;
  list: HTMLUListElement | null;
};

type NetworkFailure = {
  url: string;
  status?: number;
  statusText?: string;
  initiatorType?: string;
  method?: string;
  ts: string;
  type: 'resource' | 'fetch';
};

const ERROR_ID_PROP = '__lsDiagnosticsErrorId';
const ERROR_CAPTURED_PROP = '__lsDiagnosticsCaptured';

const ensureString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
};

export const normalizeUnknownError = (value: unknown): NormalizedError => {
  if (value instanceof Error) {
    const message = String(value.message || value.name || '').trim();
    return {
      message: message || 'Unknown error',
      stack: value.stack,
      name: value.name,
      rawType: 'Error'
    };
  }

  if (typeof value === 'string') {
    const message = value.trim();
    return {
      message: message || 'Unknown error',
      rawType: 'string'
    };
  }

  const rawType =
    value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  let jsonPreview = '';
  let message = '';

  try {
    jsonPreview = JSON.stringify(value);
    message = jsonPreview || '';
  } catch {
    message = ensureString(value);
  }

  const trimmedMessage = String(message).trim();
  return {
    message: trimmedMessage || 'Unknown error',
    rawType,
    jsonPreview: jsonPreview || undefined
  };
};

const formatEntryDetails = (entry: DiagnosticsEntry): string => {
  const errorId = entry.errorId ? `Error ID: ${entry.errorId}` : '';
  const location = entry.filename
    ? `${entry.filename}${entry.lineno ? `:${entry.lineno}` : ''}${
        entry.colno ? `:${entry.colno}` : ''
      }`
    : '';
  const source = entry.source ? `Source: ${entry.source}` : '';
  const rawType = entry.rawType ? `Type: ${entry.rawType}` : '';
  const stack = entry.stack ? `Stack:\n${entry.stack}` : '';
  const jsonPreview = entry.jsonPreview ? `Data: ${entry.jsonPreview}` : '';
  return [errorId, location, source, rawType, stack, jsonPreview]
    .filter(Boolean)
    .join('\n');
};

const loadStoredEntries = (): DiagnosticsEntry[] => {
  const raw = safeGetItem(DIAGNOSTICS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.slice(-MAX_ENTRIES) as DiagnosticsEntry[];
    }
  } catch {
    return [];
  }
  return [];
};

const persistEntries = (entries: DiagnosticsEntry[]) => {
  safeSetItem(DIAGNOSTICS_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
};

const collectFailedResources = (): NetworkFailure[] => {
  if (!('performance' in window) || !performance.getEntriesByType) {
    return [];
  }
  const resources = performance.getEntriesByType(
    'resource'
  ) as PerformanceResourceTiming[];
  return resources
    .map((entry) => {
      const status =
        'responseStatus' in entry
          ? Number((entry as PerformanceResourceTiming & { responseStatus?: number }).responseStatus)
          : undefined;
      const failed =
        (typeof status === 'number' && status >= 400) ||
        (typeof status === 'number' && status === 0);
      if (!failed) return null;
      return {
        url: entry.name,
        status: typeof status === 'number' ? status : undefined,
        initiatorType: entry.initiatorType || undefined,
        ts: new Date().toISOString(),
        type: 'resource' as const
      };
    })
    .filter(Boolean) as NetworkFailure[];
};

const buildReport = (
  entries: DiagnosticsEntry[],
  networkFailures: NetworkFailure[]
) => ({
  generatedAt: new Date().toISOString(),
  url: window.location.href,
  userAgent: navigator.userAgent,
  entries,
  lastBreadcrumb:
    entries
      .slice()
      .reverse()
      .find((entry) => entry.kind === 'breadcrumb')?.message ?? null,
  network: {
    failedResources: collectFailedResources(),
    failedFetches: networkFailures
  }
});

const copyDiagnostics = async (
  entries: DiagnosticsEntry[],
  networkFailures: NetworkFailure[]
): Promise<boolean> => {
  const content = JSON.stringify(buildReport(entries, networkFailures), null, 2);
  if (!content) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
      return true;
    }
  } catch {
    // ignore
  }
  const textarea = document.createElement('textarea');
  textarea.value = content;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  try {
    if (document.execCommand('copy')) {
      textarea.remove();
      return true;
    }
  } catch {
    // ignore
  }
  textarea.remove();
  try {
    window.prompt('Copy diagnostics', content);
    return true;
  } catch {
    return false;
  }
};

const renderEntry = (entry: DiagnosticsEntry) => {
  const item = document.createElement('li');
  item.className = 'diagnostics-panel__item';
  const header = document.createElement('div');
  header.className = 'diagnostics-panel__header';
  header.textContent = `${entry.kind.toUpperCase()} • ${entry.message}`;
  const details = document.createElement('pre');
  details.className = 'diagnostics-panel__details';
  details.textContent = formatEntryDetails(entry);
  item.append(header, details);
  return item;
};

const updatePanel = (state: DiagnosticsState) => {
  if (!state.list) return;
  state.list.innerHTML = '';
  const entries = state.entries.slice().reverse();
  if (!entries.length) {
    const empty = document.createElement('li');
    empty.className = 'diagnostics-panel__empty';
    empty.textContent = 'Нет событий.';
    state.list.append(empty);
    return;
  }
  entries.forEach((entry) => {
    state.list?.append(renderEntry(entry));
  });
};

const showCopyStatus = (
  element: HTMLElement,
  ok: boolean
): number => {
  element.textContent = ok ? 'Скопировано.' : 'Не удалось скопировать.';
  return window.setTimeout(() => {
    element.textContent = '';
  }, 4000);
};

const createPanel = (
  state: DiagnosticsState,
  onCopy: () => Promise<boolean>
): HTMLDetailsElement => {
  const panel = document.createElement('details');
  panel.className = 'diagnostics-panel';
  panel.open = false;

  const summary = document.createElement('summary');
  summary.textContent = 'Diagnostics';

  const actions = document.createElement('div');
  actions.className = 'diagnostics-panel__actions';

  const copyStatus = document.createElement('span');
  copyStatus.className = 'diagnostics-panel__status';

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'button small';
  copyButton.textContent = 'Copy diagnostics';
  copyButton.addEventListener('click', async () => {
    const ok = await onCopy();
    showCopyStatus(copyStatus, ok);
  });

  actions.append(copyStatus, copyButton);

  const list = document.createElement('ul');
  list.className = 'diagnostics-panel__list';

  panel.append(summary, actions, list);
  state.panel = panel;
  state.list = list;
  return panel;
};

const buildEntryId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const markErrorObject = (value: unknown, errorId: string, captured: boolean) => {
  if (!value || typeof value !== 'object') return;
  try {
    Object.defineProperty(value, ERROR_ID_PROP, {
      value: errorId,
      configurable: true
    });
    Object.defineProperty(value, ERROR_CAPTURED_PROP, {
      value: captured,
      configurable: true
    });
  } catch {
    // ignore
  }
};

const getMarkedErrorId = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = (value as { [ERROR_ID_PROP]?: unknown })[ERROR_ID_PROP];
  return typeof candidate === 'string' ? candidate : null;
};

const isMarkedCaptured = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  return Boolean((value as { [ERROR_CAPTURED_PROP]?: boolean })[ERROR_CAPTURED_PROP]);
};

const fromErrorEvent = (event: ErrorEvent): DiagnosticsEntry | null => {
  if (event.error && isMarkedCaptured(event.error)) {
    return null;
  }
  const normalized = normalizeUnknownError(event.error ?? event.message);
  const errorId = getMarkedErrorId(event.error) ?? buildEntryId();
  return {
    id: errorId,
    errorId,
    ts: new Date().toISOString(),
    kind: 'error',
    message: normalized.message,
    stack: normalized.stack,
    name: normalized.name,
    rawType: normalized.rawType,
    jsonPreview: normalized.jsonPreview,
    filename: event.filename || undefined,
    lineno: event.lineno || undefined,
    colno: event.colno || undefined
  };
};

const fromResourceEvent = (event: Event): DiagnosticsEntry => {
  const target = event.target as HTMLElement | null;
  const tag = target?.tagName ? target.tagName.toLowerCase() : 'resource';
  const source =
    (target instanceof HTMLScriptElement && target.src) ||
    (target instanceof HTMLLinkElement && target.href) ||
    (target instanceof HTMLImageElement && target.src) ||
    '';
  const message = `Resource load failed: ${tag}${source ? ` (${source})` : ''}`;
  const errorId = buildEntryId();
  return {
    id: errorId,
    errorId,
    ts: new Date().toISOString(),
    kind: 'resource',
    message,
    rawType: 'resource',
    source: source || undefined
  };
};

const fromRejectionEvent = (
  event: PromiseRejectionEvent
): DiagnosticsEntry | null => {
  if (event.reason && isMarkedCaptured(event.reason)) {
    return null;
  }
  const normalized = normalizeUnknownError(event.reason);
  const errorId = getMarkedErrorId(event.reason) ?? buildEntryId();
  return {
    id: errorId,
    errorId,
    ts: new Date().toISOString(),
    kind: 'rejection',
    message: normalized.message,
    stack: normalized.stack,
    name: normalized.name,
    rawType: normalized.rawType,
    jsonPreview: normalized.jsonPreview
  };
};

const fromConsoleEvent = (
  level: 'warn' | 'error',
  args: unknown[]
): DiagnosticsEntry => {
  const normalizedArgs = args.map((value) => normalizeUnknownError(value));
  const message = normalizedArgs.map((entry) => entry.message).join(' ').trim();
  let jsonPreview = '';
  try {
    jsonPreview = JSON.stringify(args);
  } catch {
    jsonPreview = '';
  }
  const errorId = buildEntryId();
  return {
    id: errorId,
    errorId,
    ts: new Date().toISOString(),
    kind: 'console',
    level,
    message: message || 'Console message',
    rawType: `console:${level}`,
    jsonPreview: jsonPreview || undefined
  };
};

const fromUnknownError = (
  error: unknown,
  source?: string
): DiagnosticsEntry => {
  const normalized = normalizeUnknownError(error);
  const errorId = buildEntryId();
  markErrorObject(error, errorId, true);
  return {
    id: errorId,
    errorId,
    ts: new Date().toISOString(),
    kind: 'error',
    message: normalized.message,
    stack: normalized.stack,
    name: normalized.name,
    rawType: normalized.rawType,
    jsonPreview: normalized.jsonPreview,
    source
  };
};

const fromOverlayInvocation = (
  error: unknown,
  invoker: Error,
  source?: string
): DiagnosticsEntry => {
  const normalized = normalizeUnknownError(error);
  const errorId = buildEntryId();
  const stackParts = [
    normalized.stack,
    invoker.stack ? `Invoker stack:\n${invoker.stack}` : ''
  ].filter(Boolean);
  return {
    id: errorId,
    errorId,
    ts: new Date().toISOString(),
    kind: 'overlay',
    message: 'overlay_invoked',
    stack: stackParts.join('\n') || invoker.stack,
    name: normalized.name,
    rawType: normalized.rawType || 'overlay',
    jsonPreview: normalized.jsonPreview,
    source
  };
};

const fromBreadcrumb = (message: string): DiagnosticsEntry => {
  const errorId = buildEntryId();
  return {
    id: errorId,
    errorId,
    ts: new Date().toISOString(),
    kind: 'breadcrumb',
    message,
    rawType: 'breadcrumb'
  };
};

export type DiagnosticsController = {
  getEntries: () => DiagnosticsEntry[];
  copy: () => Promise<boolean>;
  onEntry: (callback: (entry: DiagnosticsEntry) => void) => void;
  captureError: (error: unknown, source?: string) => DiagnosticsEntry;
  captureOverlayInvocation: (
    error: unknown,
    invoker: Error,
    source?: string
  ) => DiagnosticsEntry;
  pushBreadcrumb: (step: string) => DiagnosticsEntry;
};

export const initDiagnostics = (): DiagnosticsController => {
  const state: DiagnosticsState = {
    entries: loadStoredEntries(),
    panel: null,
    list: null
  };
  const networkFailures: NetworkFailure[] = [];
  const entryListeners = new Set<(entry: DiagnosticsEntry) => void>();

  const pushEntry = (entry: DiagnosticsEntry) => {
    state.entries = [...state.entries, entry].slice(-MAX_ENTRIES);
    persistEntries(state.entries);
    updatePanel(state);
    entryListeners.forEach((listener) => listener(entry));
  };

  const handleError = (event: Event) => {
    if (event instanceof ErrorEvent) {
      const entry = fromErrorEvent(event);
      if (entry) {
        pushEntry(entry);
      }
      return;
    }
    pushEntry(fromResourceEvent(event));
  };

  const handleRejection = (event: PromiseRejectionEvent) => {
    const entry = fromRejectionEvent(event);
    if (entry) {
      pushEntry(entry);
    }
  };

  const wrapConsole = (level: 'warn' | 'error') => {
    const original = console[level];
    console[level] = (...args: unknown[]) => {
      try {
        pushEntry(fromConsoleEvent(level, args));
      } catch {
        // ignore
      }
      original.apply(console, args);
    };
  };

  const wrapFetch = () => {
    if (!('fetch' in window)) return;
    const original = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      try {
        const response = await original(...args);
        if (!response.ok) {
          networkFailures.push({
            url: response.url,
            status: response.status,
            statusText: response.statusText,
            method: (args[1]?.method || 'GET').toUpperCase(),
            ts: new Date().toISOString(),
            type: 'fetch'
          });
        }
        return response;
      } catch (error) {
        const request = args[0];
        const url =
          typeof request === 'string'
            ? request
            : request instanceof Request
              ? request.url
              : 'unknown';
        networkFailures.push({
          url,
          statusText: normalizeUnknownError(error).message,
          method: (args[1]?.method || 'GET').toUpperCase(),
          ts: new Date().toISOString(),
          type: 'fetch'
        });
        throw error;
      }
    };
  };

  window.addEventListener('error', handleError, true);
  window.addEventListener('unhandledrejection', handleRejection);

  wrapConsole('warn');
  wrapConsole('error');
  wrapFetch();

  const panel = createPanel(state, () => {
    return copyDiagnostics(state.entries, networkFailures);
  });
  document.body.append(panel);
  updatePanel(state);

  return {
    getEntries: () => state.entries,
    copy: () => copyDiagnostics(state.entries, networkFailures),
    onEntry: (callback) => {
      entryListeners.add(callback);
    },
    captureError: (error, source) => {
      const entry = fromUnknownError(error, source);
      pushEntry(entry);
      try {
        if (typeof window.reportError === 'function') {
          const reportedError =
            error instanceof Error ? error : new Error(entry.message);
          markErrorObject(reportedError, entry.errorId, true);
          window.reportError(reportedError);
        }
      } catch {
        // ignore
      }
      return entry;
    },
    captureOverlayInvocation: (error, invoker, source) => {
      const entry = fromOverlayInvocation(error, invoker, source);
      pushEntry(entry);
      return entry;
    },
    pushBreadcrumb: (step) => {
      const entry = fromBreadcrumb(step);
      pushEntry(entry);
      return entry;
    }
  };
};
