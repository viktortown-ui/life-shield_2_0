import { createIslandPage } from './islandPage';
import { createSettingsScreen } from './settings';
import { createShieldScreen } from './shield';
import { IslandId } from '../core/types';

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

export const initRouter = (root: HTMLElement) => {
  const render = () => {
    root.innerHTML = '';
    const route = parseRoute();
    if (route.name === 'island') {
      root.appendChild(createIslandPage(route.id));
      return;
    }
    if (route.name === 'settings') {
      root.appendChild(createSettingsScreen());
      return;
    }
    root.appendChild(createShieldScreen());
  };

  window.addEventListener('hashchange', render);
  render();
};
