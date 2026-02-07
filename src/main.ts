import './styles/main.css';
import { ensureState } from './core/store';
import { applyUpdate, initPwaUpdate, onUpdateState } from './core/pwaUpdate';
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
  bannerButton.addEventListener('click', () => {
    applyUpdate();
  });

  onUpdateState((state) => {
    banner.classList.toggle('hidden', !state.ready);
  });

  const root = document.getElementById('app');
  if (root) {
    initRouter(root);
  }
} catch (error) {
  renderFatalError(error);
}
