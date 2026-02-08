import './styles/main.css';
import { initDiagnostics, normalizeUnknownError, type DiagnosticsEntry } from './core/diagnostics';
import { ensureState } from './core/store';
import {
  applyUpdate,
  initPwaUpdate,
  onUpdateState,
  panicReset
} from './core/pwaUpdate';
import { safeClear } from './core/storage';
import { initRouter } from './ui/router';

const formatInlineError = (error: unknown) => {
  const isEntry =
    typeof error === 'object' &&
    error !== null &&
    'kind' in error &&
    'message' in error;

  if (isEntry) {
    const entry = error as DiagnosticsEntry;
    const location = entry.filename
      ? `${entry.filename}${entry.lineno ? `:${entry.lineno}` : ''}${
          entry.colno ? `:${entry.colno}` : ''
        }`
      : '';
    const stackLines = [
      entry.stack,
      entry.jsonPreview ? `Data: ${entry.jsonPreview}` : '',
      entry.source ? `Source: ${entry.source}` : '',
      location ? `Location: ${location}` : ''
    ].filter(Boolean);
    return {
      message: entry.message,
      stack: stackLines.join('\n')
    };
  }

  const normalized = normalizeUnknownError(error);
  return {
    message: normalized.message,
    stack: normalized.stack || normalized.jsonPreview || ''
  };
};

const initErrorOverlay = (onCopyDiagnostics: () => void) => {
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

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'button small';
  copyButton.textContent = 'Copy diagnostics';

  const debugToggle = document.createElement('label');
  debugToggle.className = 'error-overlay__debug';

  const debugCheckbox = document.createElement('input');
  debugCheckbox.type = 'checkbox';

  const debugLabel = document.createElement('span');
  debugLabel.textContent = 'Debug';

  debugToggle.append(debugCheckbox, debugLabel);
  actions.append(copyButton, debugToggle);
  card.append(title, message, stack, actions);
  overlay.append(card);
  document.body.append(overlay);

  const isProd = import.meta.env.PROD;
  let debugEnabled = !isProd;

  if (!isProd) {
    debugToggle.classList.add('hidden');
  } else {
    debugCheckbox.checked = false;
  }

  const updateStackVisibility = () => {
    debugEnabled = !isProd || debugCheckbox.checked;
    stack.classList.toggle('hidden', !debugEnabled);
  };

  updateStackVisibility();

  debugCheckbox.addEventListener('change', updateStackVisibility);

  const showError = (error: unknown) => {
    const { message: msg, stack: stackText } = formatInlineError(error);
    message.textContent = msg || 'Неизвестная ошибка.';
    stack.textContent = stackText;
    overlay.classList.remove('hidden');
    updateStackVisibility();
  };

  copyButton.addEventListener('click', () => {
    onCopyDiagnostics();
  });

  return showError;
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
    try {
      safeClear();
    } finally {
      window.location.reload();
    }
  });
};

let showErrorOverlay: ((error: unknown) => void) | null = null;
const diagnostics = initDiagnostics();

try {
  showErrorOverlay = initErrorOverlay(() => {
    void diagnostics.copy();
  });
  diagnostics.onEntry((entry) => {
    showErrorOverlay?.(entry);
  });
  ensureState();
  initPwaUpdate();

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
  const isDebug = !import.meta.env.PROD;

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

  bannerButton.addEventListener('click', () => {
    if (needsPanicReset) {
      void panicReset();
    } else {
      applyUpdate();
    }
  });

  onUpdateState((state) => {
    needsPanicReset = state.panic;
    if (state.panic) {
      bannerText.textContent = 'Новая версия доступна. Сбросить кэш?';
      bannerButton.textContent = 'Сбросить кэш';
    } else {
      bannerText.textContent = 'Доступно обновление.';
      bannerButton.textContent = 'Обновить';
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
    initRouter(root);
  }
} catch (error) {
  if (showErrorOverlay) {
    showErrorOverlay(error);
  } else {
    initErrorOverlay(() => {
      void diagnostics.copy();
    })(error);
  }
  renderFatalError(error);
}
