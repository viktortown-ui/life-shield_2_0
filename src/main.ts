import './styles/main.css';
import { ensureState } from './core/store';
import {
  applyUpdate,
  initPwaUpdate,
  onUpdateState,
  panicReset
} from './core/pwaUpdate';
import { initRouter } from './ui/router';

const initErrorOverlay = () => {
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
  copyButton.textContent = 'Скопировать';

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

  const formatError = (error: unknown) => {
    if (error instanceof Error) {
      return {
        message: error.message || error.name,
        stack: error.stack || ''
      };
    }
    if (typeof error === 'string') {
      return { message: error, stack: '' };
    }
    try {
      return { message: JSON.stringify(error), stack: '' };
    } catch {
      return { message: String(error), stack: '' };
    }
  };

  const showError = (error: unknown) => {
    const { message: msg, stack: stackText } = formatError(error);
    message.textContent = msg || 'Неизвестная ошибка.';
    stack.textContent = stackText;
    overlay.classList.remove('hidden');
    updateStackVisibility();
  };

  const copyToClipboard = async () => {
    const content = debugEnabled && stack.textContent
      ? `${message.textContent}\n\n${stack.textContent}`
      : message.textContent || '';
    if (!content) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
        return;
      }
    } catch {
      // ignore and fall back
    }
    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  };

  copyButton.addEventListener('click', () => {
    void copyToClipboard();
  });

  window.addEventListener('error', (event) => {
    showError(event.error ?? event.message);
  });

  window.addEventListener('unhandledrejection', (event) => {
    showError(event.reason);
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
      localStorage.clear();
    } finally {
      window.location.reload();
    }
  });
};

let showErrorOverlay: ((error: unknown) => void) | null = null;

try {
  showErrorOverlay = initErrorOverlay();
  ensureState();
  initPwaUpdate();

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
  });

  const root = document.getElementById('app');
  if (root) {
    initRouter(root);
  }
} catch (error) {
  if (showErrorOverlay) {
    showErrorOverlay(error);
  } else {
    initErrorOverlay()(error);
  }
  renderFatalError(error);
}
