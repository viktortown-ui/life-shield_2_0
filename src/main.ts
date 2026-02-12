import './styles/main.css';
import {
  initDiagnostics,
  normalizeUnknownError,
  type DiagnosticsEntry
} from './core/diagnostics';
import { buildInfo } from './core/buildInfo';
import {
  isMutedScriptErrorEntry,
  shouldShowFatalOverlay
} from './core/diagnosticsOverlay';
import { ensureState } from './core/store';
import {
  applyUpdate,
  checkForUpdate,
  initPwaUpdate,
  onUpdateState,
  panicReset
} from './core/pwaUpdate';
import { reportCaughtError } from './core/reportError';
import { initRouter } from './ui/router';
import { isDebugEnabled } from './core/debug';

const isDiagnosticsEntry = (error: unknown): error is DiagnosticsEntry =>
  typeof error === 'object' &&
  error !== null &&
  'kind' in error &&
  'message' in error &&
  'errorId' in error;

const formatInlineError = (error: unknown) => {
  const isEntry = isDiagnosticsEntry(error);

  if (isEntry) {
    const entry = error;
    const location = entry.filename
      ? `${entry.filename}${entry.lineno ? `:${entry.lineno}` : ''}${
          entry.colno ? `:${entry.colno}` : ''
        }`
      : '';
    const stackLines = [
      entry.errorId ? `Error ID: ${entry.errorId}` : '',
      entry.stack,
      entry.jsonPreview ? `Data: ${entry.jsonPreview}` : '',
      entry.source ? `Source: ${entry.source}` : '',
      entry.rawType ? `Type: ${entry.rawType}` : '',
      location ? `Location: ${location}` : ''
    ].filter(Boolean);
    return {
      message: entry.message,
      stack: stackLines.join('\n')
    };
  }

  const normalized = normalizeUnknownError(error);
  const details = [
    normalized.stack,
    normalized.jsonPreview,
    normalized.rawType ? `Type: ${normalized.rawType}` : ''
  ].filter(Boolean);
  return {
    message: normalized.message,
    stack: details.join('\n')
  };
};

const initErrorOverlay = (
  diagnostics: ReturnType<typeof initDiagnostics>,
  onCopyDiagnostics: () => Promise<boolean>,
  onDownloadDiagnostics: () => void,
  onDumpUiState: () => void
) => {
  const overlay = document.createElement('div');
  overlay.className = 'error-overlay hidden';

  const card = document.createElement('div');
  card.className = 'error-overlay__card';

  const title = document.createElement('h2');
  title.textContent = 'Произошла ошибка';

  const message = document.createElement('p');
  message.className = 'error-overlay__message';

  const stack = document.createElement('pre');
  stack.className = 'error-overlay__stack';

  const actions = document.createElement('div');
  actions.className = 'error-overlay__actions';

  const copyStatus = document.createElement('span');
  copyStatus.className = 'error-overlay__status';

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'button small';
  copyButton.textContent = 'Скопировать отчёт';

  const dumpButton = document.createElement('button');
  dumpButton.type = 'button';
  dumpButton.className = 'button small';
  dumpButton.textContent = 'Снять UI-дамп';

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'button small';
  resetButton.textContent = 'Сбросить данные';

  const debugToggle = document.createElement('label');
  debugToggle.className = 'error-overlay__debug';

  const debugCheckbox = document.createElement('input');
  debugCheckbox.type = 'checkbox';

  const debugLabel = document.createElement('span');
  debugLabel.textContent = 'Показать детали';

  debugToggle.append(debugCheckbox, debugLabel);

  const downloadButton = document.createElement('button');
  downloadButton.type = 'button';
  downloadButton.className = 'button small';
  downloadButton.textContent = 'Скачать JSON отчёта';

  const buttons = document.createElement('div');
  buttons.className = 'error-overlay__buttons';
  buttons.append(copyButton, downloadButton, dumpButton, resetButton);
  actions.append(copyStatus, buttons, debugToggle);
  card.append(title, message, stack, actions);
  overlay.append(card);
  document.body.append(overlay);

  const overlayDebugEnabled = isDebugEnabled();
  debugCheckbox.checked = overlayDebugEnabled;

  const updateStackVisibility = () => {
    const showDetails = overlayDebugEnabled && debugCheckbox.checked;
    stack.classList.toggle('hidden', !showDetails);
  };

  if (!overlayDebugEnabled) {
    debugToggle.classList.add('hidden');
  }

  updateStackVisibility();
  debugCheckbox.addEventListener('change', updateStackVisibility);

  const getReasonInfo = (error: unknown) => {
    if (isDiagnosticsEntry(error)) {
      return {
        kind: error.kind,
        message: error.message
      };
    }
    const normalized = normalizeUnknownError(error);
    return {
      kind: 'unknown',
      message: normalized.message
    };
  };

  const updateOverlayState = (
    visible: boolean,
    reasonKind: string | null = null,
    invokerStackTop: string | null = null
  ) => {
    diagnostics.setOverlayState({
      visible,
      title: title.textContent ?? '',
      messageLen: message.textContent?.length ?? 0,
      lastShownReasonKind: reasonKind,
      invokerStackTop
    });
  };

  const showError = (error: unknown) => {
    const { message: msg, stack: stackText } = formatInlineError(error);
    const invoker = new Error('overlay shown');
    const reason = getReasonInfo(error);
    diagnostics.captureOverlayProbe(
      'overlay_shown',
      {
        reasonKind: reason.kind,
        reasonMessage: reason.message,
        buildId: buildInfo.id
      },
      { force: true }
    );
    message.textContent = msg || 'Неизвестная ошибка.';
    stack.textContent = stackText;
    diagnostics.captureEvent({
      kind: 'overlay_shown',
      message: 'overlay shown',
      rawType: 'overlay_shown',
      jsonPreview: JSON.stringify({
        reasonKind: reason.kind,
        reasonMessage: reason.message,
        buildId: buildInfo.id
      }),
      invokerStack: invoker.stack
    });
    overlay.classList.remove('hidden');
    updateStackVisibility();
    const invokerStackTop =
      invoker.stack
        ?.split('\n')
        .slice(1)
        .find((line) => line.trim().length > 0)
        ?.trim() ?? null;
    updateOverlayState(true, reason.kind, invokerStackTop);
  };

  const hideOverlay = (reason: string) => {
    if (overlay.classList.contains('hidden')) return;
    overlay.classList.add('hidden');
    message.textContent = '';
    stack.textContent = '';
    updateOverlayState(false, null, null);
    diagnostics.captureEvent({
      kind: 'overlay_auto_hidden_no_fatal',
      message: 'overlay auto-hidden: no fatal error',
      rawType: 'overlay_auto_hidden_no_fatal',
      jsonPreview: JSON.stringify({ reason })
    });
  };

  copyButton.addEventListener('click', async () => {
    try {
      const ok = await onCopyDiagnostics();
      copyStatus.textContent = ok ? 'Скопировано.' : 'Не удалось скопировать.';
    } catch (error) {
      reportCaughtError(error);
      copyStatus.textContent = 'Не удалось скопировать.';
    }
    window.setTimeout(() => {
      copyStatus.textContent = '';
    }, 4000);
  });

  downloadButton.addEventListener('click', () => {
    try {
      onDownloadDiagnostics();
      copyStatus.textContent = 'JSON скачан.';
    } catch (error) {
      reportCaughtError(error);
      copyStatus.textContent = 'Не удалось скачать JSON.';
    }
    window.setTimeout(() => {
      copyStatus.textContent = '';
    }, 4000);
  });

  dumpButton.addEventListener('click', () => {
    try {
      onDumpUiState();
      copyStatus.textContent = 'UI state dumped.';
    } catch (error) {
      reportCaughtError(error);
      copyStatus.textContent = 'Не удалось снять дамп.';
    }
    window.setTimeout(() => {
      copyStatus.textContent = '';
    }, 4000);
  });

  resetButton.addEventListener('click', () => {
    void panicReset().catch(reportCaughtError);
  });

  return {
    showError,
    hideOverlay,
    isVisible: () => !overlay.classList.contains('hidden')
  };
};

const initMutedErrorBanner = (
  diagnostics: ReturnType<typeof initDiagnostics>,
  onCopyDiagnostics: () => Promise<boolean>
) => {
  const banner = document.createElement('div');
  banner.className = 'muted-error-banner hidden';
  banner.innerHTML = `
    <div class="muted-error-banner__content">
      <strong>Произошла ошибка без деталей.</strong>
      <span class="muted-error-banner__message"></span>
    </div>
    <div class="muted-error-banner__actions">
      <button class="button small" data-copy>Скопировать диагностику</button>
      <button class="button small" data-reset>Сбросить кэш (SW)</button>
    </div>
    <span class="muted-error-banner__status"></span>
  `;
  document.body.prepend(banner);

  const message = banner.querySelector(
    '.muted-error-banner__message'
  ) as HTMLSpanElement;
  const status = banner.querySelector(
    '.muted-error-banner__status'
  ) as HTMLSpanElement;
  const copyButton = banner.querySelector(
    '[data-copy]'
  ) as HTMLButtonElement;
  const resetButton = banner.querySelector(
    '[data-reset]'
  ) as HTMLButtonElement;

  copyButton.addEventListener('click', async () => {
    try {
      const ok = await onCopyDiagnostics();
      status.textContent = ok ? 'Скопировано.' : 'Не удалось скопировать.';
    } catch (error) {
      reportCaughtError(error);
      status.textContent = 'Не удалось скопировать.';
    }
    window.setTimeout(() => {
      status.textContent = '';
    }, 4000);
  });

  resetButton.addEventListener('click', () => {
    const confirmed = window.confirm(
      'Сбросить сервис-воркер и весь Cache Storage? Приложение перезагрузится.'
    );
    if (!confirmed) return;
    void panicReset().catch(reportCaughtError);
  });

  const show = (entry: DiagnosticsEntry) => {
    const location = entry.filename
      ? `${entry.filename}${entry.lineno ? `:${entry.lineno}` : ''}${
          entry.colno ? `:${entry.colno}` : ''
        }`
      : '';
    message.textContent = location ? `${entry.message} (${location})` : entry.message;
    diagnostics.captureEvent({
      kind: 'overlay_shown',
      message: 'muted_error_banner_shown',
      rawType: 'muted_error_banner',
      jsonPreview: JSON.stringify({
        reasonKind: entry.kind,
        reasonMessage: entry.message,
        buildId: buildInfo.id
      })
    });
    banner.classList.remove('hidden');
  };

  return { show };
};

const renderFatalError = (error: unknown) => {
  const root = document.getElementById('app');
  if (!root) return;
  const message =
    error instanceof Error ? error.message : 'Неизвестная ошибка.';
  root.innerHTML = `
    <div class="screen">
      <h1>Произошла ошибка</h1>
      <p>${message}</p>
      <button class="button" data-reset>Reset app data</button>
    </div>
  `;
  const resetButton = root.querySelector<HTMLButtonElement>('[data-reset]');
  resetButton?.addEventListener('click', () => {
    void panicReset().catch(reportCaughtError);
  });
};

const MAX_APP_SNAPSHOT_LENGTH = 500;

const truncateSnapshot = (value: string, maxLength = MAX_APP_SNAPSHOT_LENGTH) =>
  value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;

const buildStyleSnapshot = (root: HTMLElement | null) => {
  if (!root) {
    return {
      display: 'missing',
      visibility: 'missing',
      opacity: 'missing',
      height: 0,
      width: 0
    };
  }
  const style = window.getComputedStyle(root);
  const rect = root.getBoundingClientRect();
  return {
    display: style.display,
    visibility: style.visibility,
    opacity: style.opacity,
    height: rect.height,
    width: rect.width
  };
};

const initBlankScreenWatchdog = (
  diagnostics: ReturnType<typeof initDiagnostics>
) => {
  const checkBlankScreen = () => {
    const root = document.getElementById('app');
    const styleSnapshot = buildStyleSnapshot(root);
    const childCount = root?.children.length ?? 0;
    const opacity = Number.parseFloat(styleSnapshot.opacity);
    const hasSize = styleSnapshot.height > 0 && styleSnapshot.width > 0;
    const suspicious =
      !root ||
      childCount === 0 ||
      styleSnapshot.display === 'none' ||
      styleSnapshot.visibility === 'hidden' ||
      (Number.isFinite(opacity) && opacity <= 0) ||
      !hasSize;

    if (!suspicious) return;

    diagnostics.captureEvent({
      kind: 'blank_screen_detected',
      message: 'blank_screen_detected',
      rawType: 'blank_screen_detected',
      snapshot: root
        ? truncateSnapshot(root.outerHTML)
        : 'missing #app element',
      styleSnapshot,
      invokerStack: new Error('blank screen detected').stack,
      jsonPreview: JSON.stringify({
        rootExists: Boolean(root),
        childCount,
        hasSize
      })
    });
  };

  window.setTimeout(() => {
    try {
      checkBlankScreen();
    } catch (error) {
      reportCaughtError(error);
    }
  }, 1000);

  window.setTimeout(() => {
    try {
      checkBlankScreen();
    } catch (error) {
      reportCaughtError(error);
    }
  }, 3000);
};

const initDomMutationObserver = (
  root: HTMLElement,
  diagnostics: ReturnType<typeof initDiagnostics>
) => {
  const countNodes = () => root.querySelectorAll('*').length + 1;
  let previousCount = countNodes();

  const observer = new MutationObserver(() => {
    const nextCount = countNodes();
    const delta = Math.abs(nextCount - previousCount);
    if (
      previousCount > 0 &&
      (nextCount === 0 || delta >= Math.max(10, Math.round(previousCount * 0.5)))
    ) {
      diagnostics.captureEvent({
        kind: 'dom_mutation',
        message: 'dom_mutation',
        rawType: 'dom_mutation',
        domMutation: {
          beforeCount: previousCount,
          afterCount: nextCount
        }
      });
    }
    previousCount = nextCount;
  });

  observer.observe(root, { childList: true, subtree: true });
};

let showErrorOverlay: ((error: unknown) => void) | null = null;
const diagnostics = initDiagnostics(isDebugEnabled());
let lastFatalEntry: DiagnosticsEntry | null = null;

try {
  diagnostics.pushBreadcrumb('boot: start');
  diagnostics.pushBreadcrumb('boot: load_config');
  const overlayController = initErrorOverlay(
    diagnostics,
    () => diagnostics.copy(),
    () => diagnostics.downloadReport(),
    () => {
      diagnostics.dumpUiState('manual');
    }
  );
  const mutedErrorBanner = initMutedErrorBanner(diagnostics, () =>
    diagnostics.copy()
  );
  const enforceOverlayInvariant = (reason: string) => {
    if (overlayController.isVisible() && !lastFatalEntry) {
      overlayController.hideOverlay(reason);
    }
  };
  showErrorOverlay = (error: unknown) => {
    const invoker = new Error('overlay invoked');
    const overlayEntry = diagnostics.captureOverlayInvocation(
      error,
      invoker,
      'overlay'
    );
    if (typeof window.reportError === 'function') {
      try {
        const reportable =
          error instanceof Error
            ? error
            : new Error(formatInlineError(error).message);
        window.reportError(reportable);
      } catch (error) {
        reportCaughtError(error);
        // ignore
      }
    }
    if (isDiagnosticsEntry(error)) {
      if (error.kind === 'service_worker') {
        enforceOverlayInvariant('service_worker_entry');
        return;
      }
      if (isMutedScriptErrorEntry(error)) {
        mutedErrorBanner.show(error);
        enforceOverlayInvariant('muted_script_error_entry');
        return;
      }
      if (!shouldShowFatalOverlay(error)) {
        enforceOverlayInvariant('non_fatal_entry');
        return;
      }
      const displayEntry =
        error.stack || error.jsonPreview || error.source
          ? error
          : { ...error, stack: overlayEntry.stack };
      lastFatalEntry = error;
      overlayController.showError(displayEntry);
      return;
    }
    const entry = diagnostics.captureError(error, 'overlay');
    const displayEntry =
      entry.stack || entry.jsonPreview || entry.source
        ? entry
        : { ...entry, stack: overlayEntry.stack };
    lastFatalEntry = entry;
    overlayController.showError(displayEntry);
  };
  diagnostics.onEntry((entry) => {
    if (isMutedScriptErrorEntry(entry)) {
      mutedErrorBanner.show(entry);
      enforceOverlayInvariant('muted_script_error_diagnostics_entry');
      return;
    }
    if (!shouldShowFatalOverlay(entry)) {
      enforceOverlayInvariant('non_fatal_diagnostics_entry');
      return;
    }
    lastFatalEntry = entry;
    overlayController.showError(entry);
  });
  ensureState();
  diagnostics.pushBreadcrumb('boot: load_storage');
  diagnostics.pushBreadcrumb('boot: hydrate_state');
  initPwaUpdate((entry) => {
    diagnostics.captureEvent({
      kind: 'service_worker',
      message: entry.message,
      rawType: 'service_worker',
      source: entry.source,
      jsonPreview: entry.details ? JSON.stringify(entry.details) : undefined
    });
  });

  const swBanner = document.createElement('div');
  swBanner.className = 'sw-banner hidden';
  swBanner.innerHTML = `
    <div class="sw-banner__content">
      <strong>Не удалось включить офлайн-режим.</strong>
      <span class="sw-banner__message">
        Приложение работает без сервис-воркера.
      </span>
    </div>
    <pre class="sw-banner__stack hidden"></pre>
  `;
  document.body.prepend(swBanner);

  const swStack = swBanner.querySelector('pre') as HTMLPreElement;
  const isDebug = isDebugEnabled() || !import.meta.env.PROD;

  const banner = document.createElement('div');
  banner.className = 'update-banner hidden';
  banner.innerHTML = `
    <span>Доступно обновление.</span>
    <button class="button small">Обновить</button>
  `;
  document.body.prepend(banner);

  const bannerButton = banner.querySelector('button') as HTMLButtonElement;
  const bannerText = banner.querySelector('span') as HTMLSpanElement;
  let needsPanicReset = false;

  const offlineBanner = document.createElement('div');
  offlineBanner.className = 'offline-banner hidden';
  offlineBanner.textContent =
    'Вы офлайн. Проверьте подключение, чтобы синхронизировать данные.';
  document.body.prepend(offlineBanner);

  const setOfflineState = (isOffline: boolean) => {
    offlineBanner.classList.toggle('hidden', !isOffline);
  };

  setOfflineState(!navigator.onLine);
  window.addEventListener('offline', () => setOfflineState(true));
  window.addEventListener('online', () => setOfflineState(false));

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    try {
      const response = await nativeFetch(...args);
      if (!response.ok && (response.status === 0 || response.status >= 500)) {
        setOfflineState(true);
      }
      return response;
    } catch (error) {
      setOfflineState(true);
      throw error;
    }
  };

  bannerButton.addEventListener('click', () => {
    if (needsPanicReset) {
      void panicReset().catch(reportCaughtError);
    } else {
      try {
        applyUpdate();
      } catch (error) {
        reportCaughtError(error);
      }
    }
  });

  onUpdateState((state) => {
    needsPanicReset = state.panic;
    if (state.panic) {
      bannerText.textContent =
        'Версия обновилась, нужно перезагрузить. Сбросить кэш?';
      bannerButton.textContent = 'Сбросить кэш';
      bannerButton.title =
        'Сервис-воркер и кэш будут очищены, локальные данные могут быть потеряны.';
    } else {
      bannerText.textContent = 'Доступно обновление.';
      bannerButton.textContent = 'Обновить';
      bannerButton.removeAttribute('title');
    }
    banner.classList.toggle('hidden', !state.ready && !state.panic);

    if (state.registerError) {
      const { message: errorMessage, stack } = formatInlineError(
        state.registerError
      );
      swStack.textContent = [errorMessage, stack].filter(Boolean).join('\n');
      swStack.classList.toggle('hidden', !isDebug || !swStack.textContent);
      swBanner.classList.remove('hidden');
    } else {
      swBanner.classList.add('hidden');
    }
  });

  const root = document.getElementById('app');
  if (root) {
    diagnostics.pushBreadcrumb('boot: mount_ui');
    initRouter(root);
    const runUpdateCheck = () => {
      try {
        checkForUpdate();
      } catch (error) {
        reportCaughtError(error);
      }
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => runUpdateCheck(), { timeout: 4_000 });
    } else {
      window.setTimeout(runUpdateCheck, 0);
    }

    diagnostics.pushBreadcrumb('boot: ready');
    initBlankScreenWatchdog(diagnostics);
    initDomMutationObserver(root, diagnostics);
  }
} catch (error) {
  if (typeof window.reportError === 'function') {
    try {
      const reportable = error instanceof Error ? error : new Error(String(error));
      window.reportError(reportable);
    } catch (error) {
      reportCaughtError(error);
      // ignore
    }
  }
  if (showErrorOverlay) {
    showErrorOverlay(error);
  } else {
    const entry = diagnostics.captureError(error, 'bootstrap');
    initErrorOverlay(
      diagnostics,
      () => diagnostics.copy(),
      () => {
        diagnostics.dumpUiState('manual');
      }
    ).showError(entry);
  }
  renderFatalError(error);
}
