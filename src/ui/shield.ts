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
    if (islandState.lastReport) return islandState.lastReport;
    try {
      return island.getReport(islandState.input);
    } catch (error) {
      return {
        id: island.id,
        score: 0,
        confidence: 0,
        headline: 'Ошибка острова',
        summary:
          error instanceof Error
            ? error.message
            : 'Остров не смог сформировать отчёт.',
        details: ['Попробуйте обновить страницу или повторить ввод.']
      };
    }
  });
  const verdict = buildGlobalVerdict(reports);

  header.appendChild(createAvatar(verdict, state.level));

  const summary = document.createElement('section');
  summary.className = 'shield-summary';
  summary.innerHTML = `
    <div>
      <span>Rank</span>
      <strong>${verdict.rank}</strong>
    </div>
    <div>
      <span>XP</span>
      <strong>${state.xp}</strong>
    </div>
    <div>
      <span>Стрик</span>
      <strong>${state.streakDays} д</strong>
    </div>
  `;

  const quests = document.createElement('section');
  quests.className = 'shield-quests';
  quests.innerHTML = `
    <h2>Квесты</h2>
    <div class="quest-list">
      ${verdict.quests
        .map(
          (quest) => `
        <div class="quest-card">
          <div class="quest-title">${quest.title}</div>
          <div class="quest-why">${quest.why}</div>
          <div class="quest-action">${quest.action}</div>
          <div class="quest-footer">
            <span>+${quest.rewardXp} XP</span>
            <a class="button small" href="#/island/${quest.sourceId}">Выполнить квест</a>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  `;

  const grid = document.createElement('section');
  grid.className = 'shield-grid';

  islandRegistry.forEach((island) => {
    const tile = document.createElement('a');
    tile.className = 'shield-tile';
    tile.href = `#/island/${island.id}`;

    const islandState = state.islands[island.id];
    const report = islandState.lastReport;
    const score = report?.score ?? 0;
    const confidence = report?.confidence ?? 0;
    const headline = report?.headline ?? island.title;
    const progress = islandState.progress;
    const nextStep =
      report?.actions?.[0]?.title ?? 'Запустить расчёт и сохранить результат';

    tile.innerHTML = `
      <div class="tile-score">${score}</div>
      <div class="tile-confidence">${confidence}%</div>
      <div class="tile-headline">${headline}</div>
      <div class="tile-progress">
        <span>Лучший: ${progress.bestScore}</span>
        <span>Запусков: ${progress.runsCount}</span>
      </div>
      <div class="tile-next">Следующий шаг: ${nextStep}</div>
    `;

    grid.appendChild(tile);
  });

  const actions = document.createElement('div');
  actions.className = 'screen-actions';
  actions.innerHTML = `
    <a class="button" href="#/settings">Настройки</a>
  `;

  container.append(header, summary, quests, grid, actions);
  return container;
};
