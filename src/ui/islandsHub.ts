import { islandRegistry } from '../core/registry';
import { getState } from '../core/store';

const STALE_AFTER_DAYS = 7;

const getIslandStatus = (lastRunAt: string | null, hasReport: boolean) => {
  if (!hasReport) return { label: 'Нет данных', tone: 'status--new' };
  if (!lastRunAt) return { label: 'Есть данные', tone: 'status--fresh' };
  const diffDays =
    (Date.now() - new Date(lastRunAt).getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays >= STALE_AFTER_DAYS) {
    return { label: 'Нужно обновить', tone: 'status--stale' };
  }
  return { label: 'Есть данные', tone: 'status--fresh' };
};

const whyByIsland: Record<string, string> = {
  bayes: 'Оценить риск и буфер на ближайшие месяцы.',
  hmm: 'Понять текущее состояние и куда ведёт динамика.',
  timeseries: 'Увидеть краткий прогноз тренда и волатильности.',
  optimization: 'Выбрать лучший план в рамках ограничений.',
  decisionTree: 'Сравнить варианты решений и их последствия.',
  causalDag: 'Разобрать причинно-следственные связи и рычаги.'
};

export const createIslandsHubScreen = () => {
  const state = getState();
  const container = document.createElement('div');
  container.className = 'screen islands-hub';

  const header = document.createElement('header');
  header.className = 'screen-header';
  header.innerHTML = `
    <div>
      <h1>Острова</h1>
      <p>Выберите модуль и сделайте следующий шаг.</p>
    </div>
  `;

  const grid = document.createElement('section');
  grid.className = 'shield-grid';

  islandRegistry.forEach((island) => {
    const islandState = state.islands[island.id];
    const status = getIslandStatus(
      islandState.progress.lastRunAt,
      Boolean(islandState.lastReport)
    );

    const card = document.createElement('article');
    card.className = 'shield-tile islands-hub-card';
    card.innerHTML = `
      <span class="tile-status ${status.tone}">${status.label}</span>
      <div class="tile-score">${island.title}</div>
      <div class="tile-headline">${whyByIsland[island.id] ?? island.description}</div>
      <div class="tile-progress">
        <span>Запусков: ${islandState.progress.runsCount}</span>
        <span>Лучший: ${islandState.progress.bestScore}</span>
      </div>
      <div class="tile-next"><a class="button small" href="#/island/${island.id}">Открыть</a></div>
    `;
    grid.appendChild(card);
  });

  container.append(header, grid);
  return container;
};
