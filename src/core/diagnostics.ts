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
  ts: string;
  kind: 'error' | 'rejection' | 'resource';
  message: string;
  stack?: string;
  name?: string;
  rawType: string;
  jsonPreview?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  source?: string;
};

type DiagnosticsState = {
  entries: DiagnosticsEntry[];
  panel: HTMLDetailsElement | null;
  list: HTMLUListElement | null;
};

const ensureString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
};

export const normalizeUnknownError = (value: unknown): NormalizedError => {
  if (value instanceof Error) {
    return {
      message: value.message || value.name || 'Unknown error',
      stack: value.stack,
      name: value.name,
      rawType: 'Error'
    };
  }

  if (typeof value === 'string') {
    return {
      message: value || 'Unknown error',
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

  return {
    message: message || 'Unknown error',
    rawType,
    jsonPreview: jsonPreview || undefined
  };
};

const formatEntryDetails = (entry: DiagnosticsEntry): string => {
  const location = entry.filename
    ? `${entry.filename}${entry.lineno ? `:${entry.lineno}` : ''}${
        entry.colno ? `:${entry.colno}` : ''
      }`
    : '';
  const source = entry.source ? `Source: ${entry.source}` : '';
  const stack = entry.stack ? `Stack:\n${entry.stack}` : '';
  const jsonPreview = entry.jsonPreview ? `Data: ${entry.jsonPreview}` : '';
  return [location, source, stack, jsonPreview].filter(Boolean).join('\n');
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

const buildReport = (entries: DiagnosticsEntry[]) => ({
  generatedAt: new Date().toISOString(),
  url: window.location.href,
  userAgent: navigator.userAgent,
  entries
});

const copyDiagnostics = async (entries: DiagnosticsEntry[]): Promise<void> => {
  const content = JSON.stringify(buildReport(entries), null, 2);
  if (!content) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
      return;
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
      return;
    }
  } catch {
    // ignore
  }
  textarea.remove();
  window.prompt('Copy diagnostics', content);
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

const createPanel = (
  state: DiagnosticsState,
  onCopy: () => void
): HTMLDetailsElement => {
  const panel = document.createElement('details');
  panel.className = 'diagnostics-panel';
  panel.open = false;

  const summary = document.createElement('summary');
  summary.textContent = 'Diagnostics';

  const actions = document.createElement('div');
  actions.className = 'diagnostics-panel__actions';

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'button small';
  copyButton.textContent = 'Copy diagnostics';
  copyButton.addEventListener('click', () => onCopy());

  actions.append(copyButton);

  const list = document.createElement('ul');
  list.className = 'diagnostics-panel__list';

  panel.append(summary, actions, list);
  state.panel = panel;
  state.list = list;
  return panel;
};

const buildEntryId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const fromErrorEvent = (event: ErrorEvent): DiagnosticsEntry => {
  const normalized = normalizeUnknownError(event.error ?? event.message);
  return {
    id: buildEntryId(),
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
  return {
    id: buildEntryId(),
    ts: new Date().toISOString(),
    kind: 'resource',
    message,
    rawType: 'resource',
    source: source || undefined
  };
};

const fromRejectionEvent = (
  event: PromiseRejectionEvent
): DiagnosticsEntry => {
  const normalized = normalizeUnknownError(event.reason);
  return {
    id: buildEntryId(),
    ts: new Date().toISOString(),
    kind: 'rejection',
    message: normalized.message,
    stack: normalized.stack,
    name: normalized.name,
    rawType: normalized.rawType,
    jsonPreview: normalized.jsonPreview
  };
};

export type DiagnosticsController = {
  getEntries: () => DiagnosticsEntry[];
  copy: () => Promise<void>;
  onEntry: (callback: (entry: DiagnosticsEntry) => void) => void;
};

export const initDiagnostics = (): DiagnosticsController => {
  const state: DiagnosticsState = {
    entries: loadStoredEntries(),
    panel: null,
    list: null
  };
  const entryListeners = new Set<(entry: DiagnosticsEntry) => void>();

  const pushEntry = (entry: DiagnosticsEntry) => {
    state.entries = [...state.entries, entry].slice(-MAX_ENTRIES);
    persistEntries(state.entries);
    updatePanel(state);
    entryListeners.forEach((listener) => listener(entry));
  };

  const handleError = (event: Event) => {
    if (event instanceof ErrorEvent) {
      pushEntry(fromErrorEvent(event));
      return;
    }
    pushEntry(fromResourceEvent(event));
  };

  const handleRejection = (event: PromiseRejectionEvent) => {
    pushEntry(fromRejectionEvent(event));
  };

  window.addEventListener('error', handleError, true);
  window.addEventListener('unhandledrejection', handleRejection);

  const panel = createPanel(state, () => {
    void copyDiagnostics(state.entries);
  });
  document.body.append(panel);
  updatePanel(state);

  return {
    getEntries: () => state.entries,
    copy: () => copyDiagnostics(state.entries),
    onEntry: (callback) => {
      entryListeners.add(callback);
    }
  };
};
