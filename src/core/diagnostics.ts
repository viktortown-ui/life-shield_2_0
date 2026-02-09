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
    | 'overlay_probe'
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
  uiStateDump?: UiStateDump;
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
  uiStateDump: UiStateDump | null;
  lastAutoUiDumpAt: number;
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

type UiElementStyleSnapshot = {
  exists: boolean;
  display: string;
  visibility: string;
  opacity: string;
  pointerEvents: string;
  filter: string;
  backdropFilter: string;
};

type OverlaySnapshot = {
  className: string;
  pointerEvents: string;
  zIndex: string;
  isBackdrop: boolean;
};

type ElementsFromPointEntry = {
  tagName: string;
  id: string;
  className: string;
};

type ElementsFromPointSnapshot = {
  point: 'center' | 'leftTop' | 'rightTop' | 'leftBottom' | 'rightBottom';
  x: number;
  y: number;
  elements: ElementsFromPointEntry[];
};

type OverlayTopBlocker = {
  point: ElementsFromPointSnapshot['point'];
  tagName: string;
  id: string;
  className: string;
  position: string;
  zIndex: string;
  display: string;
  visibility: string;
  opacity: string;
  pointerEvents: string;
  filter: string;
  backdropFilter: string;
};

type OverlayCandidateSnapshot = {
  tagName: string;
  id: string;
  className: string;
  zIndex: number;
  position: string;
  opacity: string;
  pointerEvents: string;
  rect: {
    width: number;
    height: number;
    area: number;
  };
};

type DialogSnapshot = {
  tagName: string;
  id: string;
  className: string;
  rect: {
    width: number;
    height: number;
    area: number;
  };
};

export type UiStateDump = {
  ts: string;
  source: 'manual' | 'hotkey' | 'auto' | 'copy' | 'overlay_probe';
  bodyClassName: string;
  bodyOverflow: string;
  app: UiElementStyleSnapshot;
  overlayContainer: UiElementStyleSnapshot;
  overlays: OverlaySnapshot[];
  elementsFromPoint: ElementsFromPointSnapshot[];
  topBlocker: OverlayTopBlocker | null;
  topCandidates: OverlayCandidateSnapshot[];
  openDialogs: DialogSnapshot[];
  uiBlocked: boolean;
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
  const uiStateDump = entry.uiStateDump
    ? `UI state dump: ${JSON.stringify(entry.uiStateDump)}`
    : '';
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
    uiStateDump,
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
  overlay: DiagnosticsOverlayState,
  uiStateDump: UiStateDump | null
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
    uiStateDump,
    network: {
      failedResources: collectFailedResources(),
      failedFetches: networkFailures
    }
  };
};

const copyDiagnostics = async (
  entries: DiagnosticsEntry[],
  networkFailures: NetworkFailure[],
  overlay: DiagnosticsOverlayState,
  uiStateDump: UiStateDump | null
): Promise<boolean> => {
  const content = JSON.stringify(
    buildReport(entries, networkFailures, overlay, uiStateDump),
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
  onCopy: () => Promise<boolean>,
  onDump: () => UiStateDump | null
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

  const buttons = document.createElement('div');
  buttons.className = 'diagnostics-panel__buttons';

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'button small';
  copyButton.textContent = 'Copy diagnostics';
  copyButton.addEventListener('click', async () => {
    const ok = await onCopy();
    showCopyStatus(copyStatus, ok);
  });

  const dumpButton = document.createElement('button');
  dumpButton.type = 'button';
  dumpButton.className = 'button small';
  dumpButton.textContent = 'Dump UI state';
  dumpButton.addEventListener('click', () => {
    const dump = onDump();
    copyStatus.textContent = dump
      ? 'UI state dumped.'
      : 'Не удалось снять дамп.';
    window.setTimeout(() => {
      copyStatus.textContent = '';
    }, 4000);
  });

  buttons.append(copyButton, dumpButton);
  actions.append(copyStatus, buttons);

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
  dumpUiState: (source?: UiStateDump['source']) => UiStateDump | null;
  onEntry: (callback: (entry: DiagnosticsEntry) => void) => void;
  captureError: (error: unknown, source?: string) => DiagnosticsEntry;
  captureOverlayInvocation: (
    error: unknown,
    invoker: Error,
    source?: string
  ) => DiagnosticsEntry;
  captureOverlayProbe: (
    message: string,
    details?: Record<string, unknown>,
    options?: { force?: boolean }
  ) => DiagnosticsEntry | null;
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
    overlay: DEFAULT_OVERLAY_STATE,
    uiStateDump: null,
    lastAutoUiDumpAt: 0
  };
  const networkFailures: NetworkFailure[] = [];
  const entryListeners = new Set<(entry: DiagnosticsEntry) => void>();
  const autoUiDumpIntervalMs = 4000;
  const overlayProbeCooldownMs = 2000;
  let lastOverlayProbeAt = 0;

  const getElementStyleSnapshot = (element: Element | null): UiElementStyleSnapshot => {
    if (!element || !(element instanceof Element)) {
      return {
        exists: false,
        display: 'missing',
        visibility: 'missing',
        opacity: 'missing',
        pointerEvents: 'missing',
        filter: 'missing',
        backdropFilter: 'missing'
      };
    }
    const style = window.getComputedStyle(element);
    return {
      exists: true,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      pointerEvents: style.pointerEvents,
      filter: style.filter,
      backdropFilter: style.backdropFilter || style.getPropertyValue('backdrop-filter')
    };
  };

  const collectUiStateDump = (
    source: UiStateDump['source']
  ): UiStateDump => {
    const bodyStyle = window.getComputedStyle(document.body);
    const viewportWidth = Math.max(0, window.innerWidth || 0);
    const viewportHeight = Math.max(0, window.innerHeight || 0);
    const clampPoint = (value: number, max: number) =>
      Math.min(Math.max(value, 0), Math.max(max - 1, 0));
    const points: Array<ElementsFromPointSnapshot['point']> = [
      'center',
      'leftTop',
      'rightTop',
      'leftBottom',
      'rightBottom'
    ];
    const pointCoords: Record<ElementsFromPointSnapshot['point'], { x: number; y: number }> = {
      center: {
        x: clampPoint(viewportWidth / 2, viewportWidth),
        y: clampPoint(viewportHeight / 2, viewportHeight)
      },
      leftTop: { x: clampPoint(1, viewportWidth), y: clampPoint(1, viewportHeight) },
      rightTop: {
        x: clampPoint(viewportWidth - 1, viewportWidth),
        y: clampPoint(1, viewportHeight)
      },
      leftBottom: {
        x: clampPoint(1, viewportWidth),
        y: clampPoint(viewportHeight - 1, viewportHeight)
      },
      rightBottom: {
        x: clampPoint(viewportWidth - 1, viewportWidth),
        y: clampPoint(viewportHeight - 1, viewportHeight)
      }
    };
    const elementsFromPointSnapshots: ElementsFromPointSnapshot[] = points.map(
      (point) => {
        const { x, y } = pointCoords[point];
        const elements = document
          .elementsFromPoint(x, y)
          .slice(0, 8)
          .map((element) => {
            const rawClassName =
              typeof (element as HTMLElement).className === 'string'
                ? (element as HTMLElement).className
                : element.getAttribute('class') ?? '';
            return {
              tagName: element.tagName.toLowerCase(),
              id: (element as HTMLElement).id || '',
              className: rawClassName.trim()
            };
          });
        return { point, x, y, elements };
      }
    );
    let topBlocker: OverlayTopBlocker | null = null;
    for (const snapshot of elementsFromPointSnapshots) {
      const stack = document.elementsFromPoint(snapshot.x, snapshot.y);
      const blocker = stack.find((element) => {
        const style = window.getComputedStyle(element);
        const opacity = Number.parseFloat(style.opacity);
        const isVisible = !Number.isNaN(opacity) ? opacity > 0.02 : true;
        return style.pointerEvents !== 'none' && isVisible;
      });
      if (blocker) {
        const style = window.getComputedStyle(blocker);
        const rawClassName =
          typeof (blocker as HTMLElement).className === 'string'
            ? (blocker as HTMLElement).className
            : blocker.getAttribute('class') ?? '';
        topBlocker = {
          point: snapshot.point,
          tagName: blocker.tagName.toLowerCase(),
          id: (blocker as HTMLElement).id || '',
          className: rawClassName.trim(),
          position: style.position,
          zIndex: style.zIndex,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          pointerEvents: style.pointerEvents,
          filter: style.filter,
          backdropFilter:
            style.backdropFilter || style.getPropertyValue('backdrop-filter')
        };
        break;
      }
    }
    const overlays = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[role="dialog"], .overlay, .modal, .backdrop'
      )
    ).map((element) => {
      const style = window.getComputedStyle(element);
      const rawClassName =
        typeof element.className === 'string'
          ? element.className
          : element.getAttribute('class') ?? '';
      const className = rawClassName.trim();
      return {
        className,
        pointerEvents: style.pointerEvents,
        zIndex: style.zIndex,
        isBackdrop: element.classList.contains('backdrop')
      };
    });
    const overlayBlocks = overlays.some(
      (overlay) => overlay.isBackdrop && overlay.pointerEvents !== 'none'
    );
    const overflowHidden =
      bodyStyle.overflow === 'hidden' ||
      bodyStyle.overflowX === 'hidden' ||
      bodyStyle.overflowY === 'hidden';
    const candidateElements = Array.from(
      document.body.querySelectorAll<HTMLElement>('*')
    );
    const overlayCandidates: OverlayCandidateSnapshot[] = candidateElements
      .map((element) => {
        const style = window.getComputedStyle(element);
        const position = style.position;
        if (position !== 'fixed' && position !== 'sticky') return null;
        if (style.pointerEvents === 'none') return null;
        if (style.visibility === 'hidden' || style.display === 'none') return null;
        const zIndexValue = Number.parseInt(style.zIndex, 10);
        const hasHighZ = Number.isFinite(zIndexValue) && zIndexValue >= 100;
        const backdropFilter =
          style.backdropFilter || style.getPropertyValue('backdrop-filter');
        const hasBackdrop = backdropFilter && backdropFilter !== 'none';
        const filter = style.filter || '';
        const hasBlur = filter.toLowerCase().includes('blur');
        if (!hasHighZ && !hasBackdrop && !hasBlur) return null;
        const rect = element.getBoundingClientRect();
        const area = rect.width * rect.height;
        const rawClassName =
          typeof element.className === 'string'
            ? element.className
            : element.getAttribute('class') ?? '';
        return {
          tagName: element.tagName.toLowerCase(),
          id: element.id || '',
          className: rawClassName.trim(),
          zIndex: Number.isFinite(zIndexValue) ? zIndexValue : 0,
          position,
          opacity: style.opacity,
          pointerEvents: style.pointerEvents,
          rect: {
            width: rect.width,
            height: rect.height,
            area
          }
        };
      })
      .filter(Boolean) as OverlayCandidateSnapshot[];
    overlayCandidates.sort((a, b) => {
      if (b.zIndex !== a.zIndex) return b.zIndex - a.zIndex;
      return b.rect.area - a.rect.area;
    });
    const topCandidates = overlayCandidates.slice(0, 20);
    const openDialogs = Array.from(
      document.querySelectorAll<HTMLDialogElement>('dialog[open]')
    ).map((dialog) => {
      const rect = dialog.getBoundingClientRect();
      const rawClassName =
        typeof dialog.className === 'string'
          ? dialog.className
          : dialog.getAttribute('class') ?? '';
      return {
        tagName: dialog.tagName.toLowerCase(),
        id: dialog.id || '',
        className: rawClassName.trim(),
        rect: {
          width: rect.width,
          height: rect.height,
          area: rect.width * rect.height
        }
      };
    });
    return {
      ts: new Date().toISOString(),
      source,
      bodyClassName: document.body.className,
      bodyOverflow: bodyStyle.overflow,
      app: getElementStyleSnapshot(document.getElementById('app')),
      overlayContainer: getElementStyleSnapshot(
        document.querySelector('.overlay-container, #overlay-container')
      ),
      overlays,
      elementsFromPoint: elementsFromPointSnapshots,
      topBlocker,
      topCandidates,
      openDialogs,
      uiBlocked: overflowHidden || overlayBlocks
    };
  };

  const recordUiStateDump = (source: UiStateDump['source']) => {
    state.uiStateDump = collectUiStateDump(source);
    return state.uiStateDump;
  };

  const captureOverlayProbe = (
    source: UiStateDump['source'],
    message: string,
    details?: Record<string, unknown>,
    options?: { force?: boolean }
  ) => {
    const now = Date.now();
    if (!options?.force && now - lastOverlayProbeAt < overlayProbeCooldownMs) {
      return null;
    }
    const dump = collectUiStateDump(source);
    state.uiStateDump = dump;
    lastOverlayProbeAt = now;
    const id = buildEntryId();
    const entry: DiagnosticsEntry = {
      id,
      errorId: id,
      ts: new Date().toISOString(),
      kind: 'overlay_probe',
      message,
      stack: new Error('overlay probe').stack,
      rawType: 'overlay_probe',
      jsonPreview: details ? JSON.stringify(details) : undefined,
      uiStateDump: dump
    };
    pushEntry(entry);
    return entry;
  };

  const maybeAutoDumpUiState = () => {
    const now = Date.now();
    if (now - state.lastAutoUiDumpAt < autoUiDumpIntervalMs) return;
    const root = document.getElementById('app');
    const rootChildCount = root ? root.childElementCount : 0;
    if (rootChildCount <= 0 || state.overlay.visible) return;
    const dump = collectUiStateDump('auto');
    if (!dump.uiBlocked) return;
    state.uiStateDump = dump;
    state.lastAutoUiDumpAt = now;
  };

  const startOverlayMutationObserver = () => {
    const body = document.body;
    if (!body || !('MutationObserver' in window)) return;
    const viewportArea = Math.max(0, window.innerWidth * window.innerHeight);
    const minArea = viewportArea * 0.3;
    const observer = new MutationObserver((mutations) => {
      const candidates: HTMLElement[] = [];
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            candidates.push(node);
          } else if (node instanceof Element) {
            candidates.push(...Array.from(node.querySelectorAll<HTMLElement>('*')));
          }
        });
      });
      const match = candidates.find((element) => {
        const style = window.getComputedStyle(element);
        if (style.position !== 'fixed' && style.position !== 'sticky') return false;
        const zIndexValue = Number.parseInt(style.zIndex, 10);
        if (!Number.isFinite(zIndexValue) || zIndexValue < 100) return false;
        const rect = element.getBoundingClientRect();
        const area = rect.width * rect.height;
        return area >= minArea;
      });
      if (match) {
        const rect = match.getBoundingClientRect();
        captureOverlayProbe('overlay_probe', 'mutation_observer', {
          tagName: match.tagName.toLowerCase(),
          id: match.id || '',
          className:
            typeof match.className === 'string'
              ? match.className
              : match.getAttribute('class') ?? '',
          rect: {
            width: rect.width,
            height: rect.height,
            area: rect.width * rect.height
          }
        });
      }
    });
    observer.observe(body, { childList: true, subtree: true });
  };

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

  const panel = createPanel(
    state,
    () => copyDiagnostics(
      state.entries,
      networkFailures,
      state.overlay,
      recordUiStateDump('copy')
    ),
    () => recordUiStateDump('manual')
  );
  document.body.append(panel);
  updatePanel(state);
  startOverlayMutationObserver();

  window.setInterval(() => {
    try {
      maybeAutoDumpUiState();
    } catch (error) {
      reportCaughtError(error);
    }
  }, autoUiDumpIntervalMs);

  window.addEventListener('keydown', (event) => {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) {
      return;
    }
    if (event.key.toLowerCase() !== 'd') {
      return;
    }
    event.preventDefault();
    recordUiStateDump('hotkey');
  });

  return {
    getEntries: () => state.entries,
    copy: () =>
      copyDiagnostics(
        state.entries,
        networkFailures,
        state.overlay,
        recordUiStateDump('copy')
      ),
    dumpUiState: (source = 'manual') => recordUiStateDump(source),
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
    captureOverlayProbe: (message, details, options) =>
      captureOverlayProbe('overlay_probe', message, details, options),
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
      try {
        maybeAutoDumpUiState();
      } catch (error) {
        reportCaughtError(error);
      }
    }
  };
};
