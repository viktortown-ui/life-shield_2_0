import { islandRegistry } from '../core/registry';
import { getState } from '../core/store';
import { buildGlobalVerdict } from '../core/verdict';
import { createAvatar } from './avatar';

export const createShieldScreen = () => {
  const container = document.createElement('div');
  container.className = 'screen shield';

  const header = document.createElement('header');
  header.className = 'screen-header';

  const title = document.createElement('div');
  title.innerHTML = '<h1>Щит</h1><p>Обзор островов и ключевых сигналов.</p>';
  header.appendChild(title);

  const state = getState();
  const reports = islandRegistry.map((island) => {
    const islandState = state.islands[island.id];
    return islandState.lastReport ?? island.getReport(islandState.input);
  });
  const verdict = buildGlobalVerdict(reports);

  header.appendChild(createAvatar(verdict));

  const summary = document.createElement('section');
  summary.className = 'shield-summary';
  summary.innerHTML = `
    <div>
      <span>Rank</span>
      <strong>${verdict.rank}</strong>
    </div>
    <div>
      <span>Настрой</span>
      <strong>${verdict.mood}</strong>
    </div>
    <div>
      <span>Хаос</span>
      <strong>${Math.round(verdict.chaos * 100)}%</strong>
    </div>
  `;

  const grid = document.createElement('section');
  grid.className = 'shield-grid';

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

  container.append(header, summary, grid, actions);
  return container;
};
