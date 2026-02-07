import { islandRegistry } from '../core/registry';
import { getState } from '../core/store';
import { createAvatar } from './avatar';

export const createShieldScreen = () => {
  const container = document.createElement('div');
  container.className = 'screen shield';

  const header = document.createElement('header');
  header.className = 'screen-header';
  header.appendChild(createAvatar());

  const title = document.createElement('div');
  title.innerHTML = '<h1>Щит</h1><p>Обзор островов и ключевых сигналов.</p>';
  header.appendChild(title);

  const grid = document.createElement('section');
  grid.className = 'shield-grid';

  const state = getState();

  islandRegistry.forEach((island) => {
    const tile = document.createElement('a');
    tile.className = 'shield-tile';
    tile.href = `#/island/${island.id}`;

    const report = state.islands[island.id].lastReport;
    const score = report?.score ?? 0;
    const confidence = report?.confidence ?? 0;
    const headline = report?.headline ?? island.title;

    tile.innerHTML = `
      <div class="tile-score">${score}</div>
      <div class="tile-confidence">${confidence}%</div>
      <div class="tile-headline">${headline}</div>
    `;

    grid.appendChild(tile);
  });

  const actions = document.createElement('div');
  actions.className = 'screen-actions';
  actions.innerHTML = `
    <a class="button" href="#/settings">Настройки</a>
  `;

  container.append(header, grid, actions);
  return container;
};
