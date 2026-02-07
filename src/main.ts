import './styles/main.css';
import { ensureState } from './core/store';
import {
  applyUpdate,
  initPwaUpdate,
  onUpdateState,
  panicReset
} from './core/pwaUpdate';
import { initRouter } from './ui/router';

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

try {
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
  renderFatalError(error);
}
