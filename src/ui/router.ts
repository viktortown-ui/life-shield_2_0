import { createIslandPage } from './islandPage';
import { createSettingsScreen } from './settings';
import { createShieldScreen } from './shield';
import { IslandId } from '../core/types';
import { panicReset } from '../core/pwaUpdate';
import { reportCaughtError } from '../core/reportError';
import { buildInfo } from '../core/buildInfo';
import { isDebugEnabled } from '../core/debug';

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

const createBuildFooter = () => {
  const footer = document.createElement('div');
  footer.className = 'build-footer';
  footer.innerHTML = `
    <span>Build ${buildInfo.id}</span>
    <span>${buildInfo.builtAt}</span>
  `;
  return footer;
};


const updateBottomNavInset = (root: HTMLElement) => {
  const nav = root.querySelector<HTMLElement>('.bottom-nav');
  if (!nav) {
    document.documentElement.style.removeProperty('--bottom-nav-inset');
    return;
  }
  const rect = nav.getBoundingClientRect();
  const distanceToViewportBottom = Math.max(0, window.innerHeight - rect.bottom);
  const inset = Math.ceil(rect.height + distanceToViewportBottom);
  document.documentElement.style.setProperty('--bottom-nav-inset', `${inset}px`);
};

const initBottomNavInsetSync = (root: HTMLElement) => {
  let rafId = 0;
  const update = () => {
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = window.requestAnimationFrame(() => updateBottomNavInset(root));
  };

  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  update();
  return update;
};

const createAppShell = (
  screen: HTMLElement,
  route: { name: 'shield' } | { name: 'settings' } | { name: 'island'; id: IslandId },
  showBuildInfo: boolean
) => {
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  const main = document.createElement('main');
  main.className = 'app-main';
  main.append(screen);

  const footer = document.createElement('footer');
  footer.className = 'app-footer';

  if (showBuildInfo) {
    footer.append(createBuildFooter());
  }

  footer.append(createBottomNav(route));
  shell.append(main, footer);
  return shell;
};

export const initRouter = (root: HTMLElement) => {
  const syncBottomNavInset = initBottomNavInsetSync(root);

  const render = () => {
    try {
      root.innerHTML = '';
      const route = parseRoute();
      const showBuildInfo = isDebugEnabled();
      if (route.name === 'island') {
        root.appendChild(
          createAppShell(createIslandPage(route.id), route, showBuildInfo)
        );
        syncBottomNavInset();
        return;
      }
      if (route.name === 'settings') {
        root.appendChild(
          createAppShell(createSettingsScreen(), route, showBuildInfo)
        );
        syncBottomNavInset();
        return;
      }
      root.appendChild(createAppShell(createShieldScreen(), route, showBuildInfo));
      syncBottomNavInset();
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
        void panicReset().catch(reportCaughtError);
      });
      syncBottomNavInset();
    }
  };

  window.addEventListener('hashchange', render);
  render();
};
