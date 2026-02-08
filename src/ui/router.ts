import { createIslandPage } from './islandPage';
import { createSettingsScreen } from './settings';
import { createShieldScreen } from './shield';
import { IslandId } from '../core/types';
import { safeClear } from '../core/storage';
import { reportCaughtError } from '../core/reportError';

const parseRoute = () => {
  const hash = window.location.hash.replace('#', '') || '/';
  const parts = hash.split('/').filter(Boolean);
  if (parts[0] === 'island' && parts[1]) {
    return { name: 'island', id: parts[1] as IslandId };
  }
  if (parts[0] === 'settings') {
    return { name: 'settings' };
  }
  return { name: 'shield' };
};

const createBottomNav = (
  route: { name: 'shield' } | { name: 'settings' } | { name: 'island'; id: IslandId }
) => {
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('aria-label', 'Нижняя навигация');

  const islandTarget =
    route.name === 'island' ? route.id : ('bayes' as IslandId);

  nav.innerHTML = `
    <a class="bottom-nav-link ${route.name === 'shield' ? 'active' : ''}" href="#/">Щит</a>
    <a class="bottom-nav-link ${route.name === 'island' ? 'active' : ''}" href="#/island/${islandTarget}">Острова</a>
    <a class="bottom-nav-link ${route.name === 'settings' ? 'active' : ''}" href="#/settings">Настройки</a>
  `;

  return nav;
};

export const initRouter = (root: HTMLElement) => {
  const render = () => {
    try {
      root.innerHTML = '';
      const route = parseRoute();
      if (route.name === 'island') {
        root.appendChild(createIslandPage(route.id));
        root.appendChild(createBottomNav(route));
        return;
      }
      if (route.name === 'settings') {
        root.appendChild(createSettingsScreen());
        root.appendChild(createBottomNav(route));
        return;
      }
      root.appendChild(createShieldScreen());
      root.appendChild(createBottomNav(route));
    } catch (error) {
      reportCaughtError(error);
      if (typeof window.reportError === 'function') {
        try {
          const reportable = error instanceof Error ? error : new Error(String(error));
          window.reportError(reportable);
        } catch (reportError) {
          reportCaughtError(reportError);
        }
      }
      root.innerHTML = `
        <div class="screen">
          <h1>Произошла ошибка</h1>
          <p>Не удалось отрисовать экран. Попробуйте сбросить данные.</p>
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
    }
  };

  window.addEventListener('hashchange', render);
  render();
};
