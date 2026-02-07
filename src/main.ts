import './styles/main.css';
import { ensureState } from './core/store';
import { applyUpdate, initPwaUpdate, onUpdateState } from './core/pwaUpdate';
import { initRouter } from './ui/router';

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
