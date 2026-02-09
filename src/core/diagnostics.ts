import { safeGetItem, safeSetItem } from './storage';
import { reportCaughtError } from './reportError';
import { buildInfo } from './buildInfo';
import { shouldShowFatalOverlay } from './diagnosticsOverlay';

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
  kind:
    | 'error'
    | 'rejection'
    | 'resource'
    | 'console_error'
    | 'overlay_invoked'
    | 'overlay_shown'
    | 'overlay_auto_hidden_no_fatal'
    | 'blank_screen_detected'
    | 'dom_mutation'
    | 'breadcrumb'
    | 'service_worker';
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
  invokerStack?: string;
  normalizedError?: NormalizedError;
  snapshot?: string;
  styleSnapshot?: {
    display: string;
    visibility: string;
    opacity: string;
    height: number;
    width: number;
  };
  domMutation?: {
    beforeCount: number;
    afterCount: number;
  };
  suspectedMuted?: boolean;
  scriptInventory?: ScriptInventoryEntry[];
  externalScripts?: ScriptInventoryEntry[];
  scriptResourceEntries?: ScriptResourceEntry[];
  lastBreadcrumb?: string | null;
};

type ScriptInventoryEntry = {
  src: string;
  origin: string;
  sameOrigin: boolean;
};

type ScriptResourceEntry = {
  name: string;
  initiatorType?: string;
};

type DiagnosticsState = {
  entries: DiagnosticsEntry[];
  panel: HTMLDetailsElement | null;
  list: HTMLUListElement | null;
  overlay: DiagnosticsOverlayState;
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
const DEFAULT_OVERLAY_STATE = {
  visible: false,
  title: '',
  messageLen: 0,
  lastShownReasonKind: null as string | null,
  invokerStackTop: null as string | null
};

export type DiagnosticsOverlayState = typeof DEFAULT_OVERLAY_STATE;

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
  } catch (error) {
    reportCaughtError(error);
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
  const invokerStack = entry.invokerStack
    ? `Invoker stack:\n${entry.invokerStack}`
    : '';
  const normalizedError = entry.normalizedError
    ? `Normalized error: ${JSON.stringify(entry.normalizedError)}`
    : '';
  const snapshot = entry.snapshot ? `Snapshot:\n${entry.snapshot}` : '';
  const styleSnapshot = entry.styleSnapshot
    ? `Style snapshot: ${JSON.stringify(entry.styleSnapshot)}`
    : '';
  const domMutation = entry.domMutation
    ? `DOM mutation: ${JSON.stringify(entry.domMutation)}`
    : '';
  const suspectedMuted = entry.suspectedMuted
    ? `Suspected muted script error: ${entry.suspectedMuted}`
    : '';
  const lastBreadcrumb = entry.lastBreadcrumb
    ? `Last breadcrumb: ${entry.lastBreadcrumb}`
    : '';
  const scriptInventory = entry.scriptInventory
    ? `Script inventory: ${JSON.stringify(entry.scriptInventory)}`
    : '';
  const externalScripts = entry.externalScripts
    ? `External scripts: ${JSON.stringify(entry.externalScripts)}`
    : '';
  const scriptResources = entry.scriptResourceEntries
    ? `Script resources: ${JSON.stringify(entry.scriptResourceEntries)}`
    : '';
  const jsonPreview = entry.jsonPreview ? `Data: ${entry.jsonPreview}` : '';
  return [
    errorId,
    location,
    source,
    rawType,
    stack,
    invokerStack,
    normalizedError,
    snapshot,
    styleSnapshot,
    domMutation,
    suspectedMuted,
    lastBreadcrumb,
    scriptInventory,
    externalScripts,
    scriptResources,
    jsonPreview
  ]
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
  } catch (error) {
    reportCaughtError(error);
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
  networkFailures: NetworkFailure[],
  overlay: DiagnosticsOverlayState
) => {
  const root = document.getElementById('app');
  const lastEntry = entries.length ? entries[entries.length - 1] : null;
  return {
    generatedAt: new Date().toISOString(),
    build: buildInfo,
    url: window.location.href,
    currentRoute: window.location.hash,
    userAgent: navigator.userAgent,
    entries,
    overlay,
    overlayVisible: overlay.visible,
    lastFatalEntry:
      entries
        .slice()
        .reverse()
        .find((entry) => shouldShowFatalOverlay(entry)) ?? null,
    lastNonFatal: lastEntry,
    lastBreadcrumb:
      entries
        .slice()
        .reverse()
        .find((entry) => entry.kind === 'breadcrumb')?.message ?? null,
    rootChildCount: root ? root.childElementCount : null,
    rootHTMLLength: root ? root.innerHTML.length : null,
    network: {
      failedResources: collectFailedResources(),
      failedFetches: networkFailures
    }
  };
};

const copyDiagnostics = async (
  entries: DiagnosticsEntry[],
  networkFailures: NetworkFailure[],
  overlay: DiagnosticsOverlayState
): Promise<boolean> => {
  const content = JSON.stringify(
    buildReport(entries, networkFailures, overlay),
    null,
    2
  );
  if (!content) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
      return true;
    }
  } catch (error) {
    reportCaughtError(error);
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
  } catch (error) {
    reportCaughtError(error);
    // ignore
  }
  textarea.remove();
  try {
    window.prompt('Copy diagnostics', content);
    return true;
  } catch (error) {
    reportCaughtError(error);
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

const collectScriptInventory = (): {
  allScripts: ScriptInventoryEntry[];
  externalScripts: ScriptInventoryEntry[];
} => {
  const scripts = Array.from(document.scripts);
  const allScripts = scripts.map((script) => {
    const src = script.src || '';
    if (!src) {
      return {
        src: '',
        origin: 'inline',
        sameOrigin: true
      };
    }
    try {
      const origin = new URL(src, window.location.href).origin;
      return {
        src,
        origin,
        sameOrigin: origin === window.location.origin
      };
    } catch {
      return {
        src,
        origin: 'invalid',
        sameOrigin: false
      };
    }
  });
  const externalScripts = allScripts.filter((entry) => !entry.sameOrigin);
  return { allScripts, externalScripts };
};

const collectScriptResources = (): ScriptResourceEntry[] => {
  if (!('performance' in window) || !performance.getEntriesByType) {
    return [];
  }
  const resources = performance.getEntriesByType(
    'resource'
  ) as PerformanceResourceTiming[];
  return resources
    .filter((entry) => entry.initiatorType === 'script')
    .map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType || undefined
    }));
};

const attachScriptInventory = (entry: DiagnosticsEntry) => {
  const { allScripts, externalScripts } = collectScriptInventory();
  entry.scriptInventory = allScripts;
  entry.externalScripts = externalScripts;
  entry.scriptResourceEntries = collectScriptResources();
};

const getLastBreadcrumb = (entries: DiagnosticsEntry[]): string | null =>
  entries
    .slice()
    .reverse()
    .find((entry) => entry.kind === 'breadcrumb')?.message ?? null;

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
  } catch (error) {
    reportCaughtError(error);
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

const isMutedScriptError = (event: ErrorEvent) => {
  if (event.message !== 'Script error.') return false;
  const hasLocation = Boolean(event.filename);
  const hasLine = typeof event.lineno === 'number' && event.lineno > 0;
  const hasCol = typeof event.colno === 'number' && event.colno > 0;
  return !hasLocation || !hasLine || !hasCol;
};

const isMutedScriptMessage = (
  message: string,
  filename?: string,
  lineno?: number,
  colno?: number
) => {
  if (message !== 'Script error.') return false;
  const hasLocation = Boolean(filename);
  const hasLine = typeof lineno === 'number' && lineno > 0;
  const hasCol = typeof colno === 'number' && colno > 0;
  return !hasLocation || !hasLine || !hasCol;
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
  } catch (error) {
    reportCaughtError(error);
    jsonPreview = '';
  }
  const errorId = buildEntryId();
  return {
    id: errorId,
    errorId,
    ts: new Date().toISOString(),
    kind: 'console_error',
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
  return {
    id: errorId,
    errorId,
    ts: new Date().toISOString(),
    kind: 'overlay_invoked',
    message: 'overlay_invoked',
    stack: normalized.stack,
    name: normalized.name,
    rawType: normalized.rawType || 'overlay',
    jsonPreview: normalized.jsonPreview,
    source,
    invokerStack: invoker.stack,
    normalizedError: normalized
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
  captureEvent: (
    entry: Omit<DiagnosticsEntry, 'id' | 'errorId' | 'ts'>
  ) => DiagnosticsEntry;
  pushBreadcrumb: (step: string) => DiagnosticsEntry;
  setOverlayState: (overlay: DiagnosticsOverlayState) => void;
};

export const initDiagnostics = (): DiagnosticsController => {
  const state: DiagnosticsState = {
    entries: loadStoredEntries(),
    panel: null,
    list: null,
    overlay: DEFAULT_OVERLAY_STATE
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
        attachScriptInventory(entry);
        if (isMutedScriptError(event)) {
          entry.suspectedMuted = true;
          entry.level = 'warn';
          entry.lastBreadcrumb = getLastBreadcrumb(state.entries);
        }
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
      } catch (error) {
        reportCaughtError(error);
        // ignore
      }
      original.apply(console, args);
    };
  };

  const wrapFetch = () => {
    if (!('fetch' in window)) return;
    const original = window.fetch.bind(window);
    let swFetchLogged = false;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      if (!swFetchLogged && navigator.serviceWorker?.controller) {
        swFetchLogged = true;
        const id = buildEntryId();
        pushEntry({
          id,
          errorId: id,
          ts: new Date().toISOString(),
          kind: 'service_worker',
          message: 'service_worker_fetch',
          rawType: 'service_worker',
          source: navigator.serviceWorker.controller.scriptURL || undefined
        });
      }
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
        reportCaughtError(error);
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

  window.onerror = (
    message,
    filename,
    lineno,
    colno,
    error
  ): boolean | void => {
    if (error && isMarkedCaptured(error)) {
      return;
    }
    const normalized = normalizeUnknownError(error ?? message);
    const errorId = getMarkedErrorId(error) ?? buildEntryId();
    const entry: DiagnosticsEntry = {
      id: errorId,
      errorId,
      ts: new Date().toISOString(),
      kind: 'error',
      message: normalized.message,
      stack: normalized.stack,
      name: normalized.name,
      rawType: normalized.rawType,
      jsonPreview: normalized.jsonPreview,
      filename: typeof filename === 'string' ? filename : undefined,
      lineno: typeof lineno === 'number' ? lineno : undefined,
      colno: typeof colno === 'number' ? colno : undefined
    };
    attachScriptInventory(entry);
    if (
      isMutedScriptMessage(
        entry.message,
        entry.filename,
        entry.lineno,
        entry.colno
      )
    ) {
      entry.suspectedMuted = true;
      entry.level = 'warn';
      entry.lastBreadcrumb = getLastBreadcrumb(state.entries);
    }
    if (error) {
      markErrorObject(error, entry.errorId, true);
    }
    pushEntry(entry);
    return;
  };

  window.addEventListener('error', handleError, true);
  window.addEventListener('unhandledrejection', handleRejection);

  wrapConsole('warn');
  wrapConsole('error');
  wrapFetch();

  const panel = createPanel(state, () => {
    return copyDiagnostics(state.entries, networkFailures, state.overlay);
  });
  document.body.append(panel);
  updatePanel(state);

  return {
    getEntries: () => state.entries,
    copy: () => copyDiagnostics(state.entries, networkFailures, state.overlay),
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
      } catch (error) {
        reportCaughtError(error);
        // ignore
      }
      return entry;
    },
    captureOverlayInvocation: (error, invoker, source) => {
      const entry = fromOverlayInvocation(error, invoker, source);
      pushEntry(entry);
      return entry;
    },
    captureEvent: (entry) => {
      const id = buildEntryId();
      const fullEntry: DiagnosticsEntry = {
        ...entry,
        id,
        errorId: id,
        ts: new Date().toISOString()
      };
      pushEntry(fullEntry);
      return fullEntry;
    },
    pushBreadcrumb: (step) => {
      const entry = fromBreadcrumb(step);
      pushEntry(entry);
      return entry;
    },
    setOverlayState: (overlay) => {
      state.overlay = overlay;
    }
  };
};
