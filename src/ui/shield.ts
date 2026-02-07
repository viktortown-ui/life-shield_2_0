import { islandRegistry } from '../core/registry';
import { getState } from '../core/store';
import { buildGlobalVerdict } from '../core/verdict';
import { IslandReport } from '../core/types';
import { createAvatar } from './avatar';

const XP_PER_LEVEL = 120;
const STALE_AFTER_DAYS = 7;

const clampMetric = (value: number) =>
  Math.min(100, Math.max(0, Math.round(value)));

const normalizeReport = (report: IslandReport): IslandReport => ({
  ...report,
  score: clampMetric(report.score),
  confidence: clampMetric(report.confidence)
});

const pickTopAction = (report: IslandReport) => {
  if (!report.actions?.length) return null;
  return [...report.actions]
    .map((action) => ({
      action,
      score: action.impact / Math.max(1, action.effort)
    }))
    .sort((a, b) => b.score - a.score)[0]?.action;
};

const getIslandStatus = (lastRunAt: string | null, hasReport: boolean) => {
  if (!hasReport) return { label: 'not started', tone: 'status--new' };
  if (!lastRunAt) return { label: 'computed', tone: 'status--fresh' };
  const diffDays =
    (Date.now() - new Date(lastRunAt).getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays >= STALE_AFTER_DAYS) {
    return { label: 'stale', tone: 'status--stale' };
  }
  return { label: 'computed', tone: 'status--fresh' };
};

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
  const normalizedReports = reports.map((report) => normalizeReport(report));
  const verdict = buildGlobalVerdict(normalizedReports);
  const reportById = new Map(
    normalizedReports.map((report) => [report.id, report])
  );
  const weakestReport = [...normalizedReports].sort(
    (a, b) => a.score - b.score
  )[0];
  const questAction = weakestReport ? pickTopAction(weakestReport) : null;
  const dailyQuest = weakestReport
    ? {
        title: questAction?.title ?? 'Собрать свежие данные',
        why:
          weakestReport.insights?.find((item) => item.severity !== 'info')
            ?.title ?? weakestReport.headline,
        action: questAction?.description ?? weakestReport.summary,
        rewardXp: Math.max(12, Math.round((100 - weakestReport.score) / 2)),
        sourceId: weakestReport.id
      }
    : null;

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

  const xpBlock = document.createElement('section');
  xpBlock.className = 'shield-xp';
  const levelBase = (state.level - 1) * XP_PER_LEVEL;
  const levelProgress = Math.max(0, state.xp - levelBase);
  const levelPercent = Math.min(
    100,
    Math.round((levelProgress / XP_PER_LEVEL) * 100)
  );
  xpBlock.innerHTML = `
    <h2>XP прогресс</h2>
    <div class="xp-meta">
      <span>Level ${state.level}</span>
      <span>${levelProgress}/${XP_PER_LEVEL} XP</span>
    </div>
    <div class="xp-bar">
      <div class="xp-bar-fill" style="width: ${levelPercent}%"></div>
    </div>
    <div class="xp-hints">
      <span>+XP за:</span>
      <ul>
        <li>Запуск анализа острова.</li>
        <li>Заполнение входных данных.</li>
        <li>Рост confidence в отчёте.</li>
      </ul>
    </div>
  `;

  const quests = document.createElement('section');
  quests.className = 'shield-quests';
  quests.innerHTML = `
    <h2>Квест дня</h2>
    <div class="quest-list">
      ${
        dailyQuest
          ? `
        <div class="quest-card">
          <div class="quest-title">${dailyQuest.title}</div>
          <div class="quest-why">${dailyQuest.why}</div>
          <div class="quest-action">${dailyQuest.action}</div>
          <div class="quest-footer">
            <span>+${dailyQuest.rewardXp} XP</span>
            <a class="button small" href="#/island/${dailyQuest.sourceId}">Выполнить квест</a>
          </div>
        </div>
      `
          : `
        <div class="quest-card">
          <div class="quest-title">Нет доступных квестов</div>
          <div class="quest-action">Добавьте данные на островах, чтобы получить задание.</div>
        </div>
      `
      }
    </div>
  `;

  const grid = document.createElement('section');
  grid.className = 'shield-grid';

  const verdictTile = document.createElement('div');
  verdictTile.className = 'shield-tile shield-tile--verdict';
  verdictTile.innerHTML = `
      <span class="tile-status status--fresh">вердикт дня</span>
      <div class="tile-score">${clampMetric(verdict.globalScore)}</div>
      <div class="tile-confidence">${clampMetric(verdict.globalConfidence)}%</div>
      <div class="tile-headline">${verdict.mood}</div>
      <div class="tile-progress">
        <span>Rank: ${verdict.rank}</span>
        <span>Chaos: ${Math.round(verdict.chaos * 100)}%</span>
      </div>
      <div class="tile-next">${
        verdict.isHighRisk || verdict.isHighUncertainty
          ? 'Фокус: снизить неопределённость.'
          : 'Фокус: удержать темп.'
      }</div>
    `;
  grid.appendChild(verdictTile);

  islandRegistry.forEach((island) => {
    const tile = document.createElement('a');
    tile.className = 'shield-tile';
    tile.href = `#/island/${island.id}`;

    const islandState = state.islands[island.id];
    const report = reportById.get(island.id) ?? islandState.lastReport;
    const score = clampMetric(report?.score ?? 0);
    const confidence = clampMetric(report?.confidence ?? 0);
    const headline = report?.headline ?? island.title;
    const progress = islandState.progress;
    const nextStep =
      report?.actions?.[0]?.title ?? 'Запустить расчёт и сохранить результат';
    const status = getIslandStatus(progress.lastRunAt, Boolean(report));

    tile.innerHTML = `
      <span class="tile-status ${status.tone}">${status.label}</span>
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

  const bottomNav = document.createElement('nav');
  bottomNav.className = 'bottom-nav';
  bottomNav.innerHTML = `
    <a class="bottom-nav-link active" href="#/">Shield</a>
    <a class="bottom-nav-link" href="#/island/bayes">Islands</a>
    <a class="bottom-nav-link" href="#/settings">Settings</a>
  `;

  container.append(header, summary, xpBlock, quests, grid, actions, bottomNav);
  return container;
};
