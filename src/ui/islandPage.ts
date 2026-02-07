import { findIsland } from '../core/registry';
import { getState, updateIslandInput, updateIslandReport } from '../core/store';
import { IslandId } from '../core/types';

export const createIslandPage = (id: IslandId) => {
  const island = findIsland(id);
  const state = getState();
  const islandState = state.islands[id];

  const container = document.createElement('div');
  container.className = 'screen island';

  if (!island) {
    container.innerHTML = '<p>Остров не найден.</p>';
    return container;
  }

  const header = document.createElement('header');
  header.className = 'screen-header';
  header.innerHTML = `
    <div>
      <h1>${island.title}</h1>
      <p>${island.description}</p>
    </div>
  `;

  const form = document.createElement('form');
  form.className = 'island-form';
  form.innerHTML = `
    <label>
      ${island.inputLabel}
      <textarea name="input" rows="6" placeholder="${island.placeholder}">${islandState.input}</textarea>
    </label>
    <button class="button" type="submit">Сохранить</button>
  `;

  const result = document.createElement('section');
  result.className = 'island-result';

  const renderReport = () => {
    const report = islandState.lastReport ?? island.getReport(islandState.input);
    result.innerHTML = `
      <div class="result-metrics">
        <div><span>Score</span><strong>${report.score}</strong></div>
        <div><span>Confidence</span><strong>${report.confidence}%</strong></div>
      </div>
      <h2>${report.headline}</h2>
      <p>${report.summary}</p>
      <ul>${report.details.map((item) => `<li>${item}</li>`).join('')}</ul>
    `;
  };

  renderReport();

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const input = String(data.get('input') ?? '');
    updateIslandInput(id, input);
    const report = island.getReport(input);
    updateIslandReport(id, report);
    islandState.input = input;
    islandState.lastReport = report;
    renderReport();
  });

  const actions = document.createElement('div');
  actions.className = 'screen-actions';
  actions.innerHTML = `
    <a class="button ghost" href="#/">К щиту</a>
    <a class="button" href="#/settings">Настройки</a>
  `;

  container.append(header, form, result, actions);
  return container;
};
