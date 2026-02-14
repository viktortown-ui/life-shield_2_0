import { createIslandPage } from './islandPage';
import { createSettingsScreen } from './settings';
import { createShieldScreen } from './shield';
import { createCosmosScreen } from './cosmos';
import { IslandId } from '../core/types';
import { panicReset } from '../core/pwaUpdate';
import { reportCaughtError } from '../core/reportError';
import { buildInfo } from '../core/buildInfo';
import { isDebugEnabled } from '../core/debug';
import { getState } from '../core/store';
import { createOnboardingModal } from './onboarding';
import { createIslandsHubScreen } from './islandsHub';
import { createReportScreen } from './report';
import { createFinanceScreen } from './finance';
import { createHistoryScreen } from './history';
import { onLangChange, t } from './i18n';

const parseRoute = () => {
  const hash = window.location.hash.replace('#', '') || '/';
  const parts = hash.split('/').filter(Boolean);
  if (parts.length === 0) {
    return { name: 'home' } as const;
  }
  if (parts[0] === 'island' && parts[1]) {
    return { name: 'island', id: parts[1] as IslandId };
  }
  if (parts[0] === 'settings') {
    return { name: 'settings' } as const;
  }
  if (parts[0] === 'islands') {
    return { name: 'islands' } as const;
  }
  if (parts[0] === 'cosmos') {
    return { name: 'cosmos' } as const;
  }
  if ((parts[0] === 'shield' && parts[1] === 'report') || parts[0] === 'report') {
    return { name: 'report' } as const;
  }
  if (parts[0] === 'finance') {
    return { name: 'finance' } as const;
  }
  if (parts[0] === 'history') {
    return { name: 'history' } as const;
  }
  if (parts[0] === 'shield') {
    return { name: 'shield' } as const;
  }
  return { name: 'home' } as const;
};

type Route =
  | { name: 'home' }
  | { name: 'shield' }
  | { name: 'cosmos' }
  | { name: 'settings' }
  | { name: 'island'; id: IslandId }
  | { name: 'islands' }
  | { name: 'report' }
  | { name: 'finance' }
  | { name: 'history' };

const createBottomNav = (route: Route) => {
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('aria-label', 'Нижняя навигация');

  nav.innerHTML = `
    <a class="bottom-nav-link ${route.name === 'shield' || route.name === 'home' || route.name === 'cosmos' ? 'active' : ''}" href="#/">${t('navHome')}</a>
    <a class="bottom-nav-link ${route.name === 'island' || route.name === 'islands' ? 'active' : ''}" href="#/islands">${t('navIslands')}</a>
    <a class="bottom-nav-link ${route.name === 'finance' ? 'active' : ''}" href="#/finance">${t('navFinance')}</a>
    <a class="bottom-nav-link ${route.name === 'history' ? 'active' : ''}" href="#/history">${t('navHistory')}</a>
    <a class="bottom-nav-link ${route.name === 'report' ? 'active' : ''}" href="#/report">${t('navReport')}</a>
    <a class="bottom-nav-link ${route.name === 'settings' ? 'active' : ''}" href="#/settings">${t('navSettings')}</a>
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


const createAppShell = (
  screen: HTMLElement,
  route: Route,
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
  const render = () => {
    try {
      root.innerHTML = '';
      const route = parseRoute();
      const showBuildInfo = isDebugEnabled();
      if (route.name === 'island') {
        root.appendChild(
          createAppShell(createIslandPage(route.id), route, showBuildInfo)
        );
      } else if (route.name === 'settings') {
        root.appendChild(
          createAppShell(createSettingsScreen(), route, showBuildInfo)
        );
      } else if (route.name === 'islands') {
        root.appendChild(
          createAppShell(createIslandsHubScreen(), route, showBuildInfo)
        );
      } else if (route.name === 'report') {
        root.appendChild(createAppShell(createReportScreen(), route, showBuildInfo));
      } else if (route.name === 'finance') {
        root.appendChild(createAppShell(createFinanceScreen(), route, showBuildInfo));
      } else if (route.name === 'cosmos') {
        root.appendChild(createAppShell(createCosmosScreen(), route, showBuildInfo));
      } else if (route.name === 'history') {
        root.appendChild(createAppShell(createHistoryScreen(), route, showBuildInfo));
      } else if (route.name === 'shield') {
        root.appendChild(createAppShell(createShieldScreen(), route, showBuildInfo));
      } else {
        const homeRoute = getState().flags.homeScreen === 'cosmos' ? { name: 'cosmos' as const } : { name: 'shield' as const };
        const screen = homeRoute.name === 'cosmos' ? createCosmosScreen() : createShieldScreen();
        root.appendChild(createAppShell(screen, homeRoute, showBuildInfo));
      }

      if (!getState().flags.onboarded) {
        root.appendChild(createOnboardingModal());
      }
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
          <button class="button" data-reset>Сбросить данные приложения</button>
        </div>
      `;
      const resetButton = root.querySelector<HTMLButtonElement>('[data-reset]');
      resetButton?.addEventListener('click', () => {
        void panicReset().catch(reportCaughtError);
      });
    }
  };

  window.addEventListener('hashchange', render);
  onLangChange(render);
  render();
};
