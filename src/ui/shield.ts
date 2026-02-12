import { islandRegistry } from '../core/registry';
import { getState } from '../core/store';
import { buildGlobalVerdict } from '../core/verdict';
import { IslandReport } from '../core/types';
import { reportCaughtError } from '../core/reportError';
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
  if (!hasReport) return { label: 'Нет данных', tone: 'status--new' };
  if (!lastRunAt) return { label: 'Есть данные', tone: 'status--fresh' };
  const diffDays =
    (Date.now() - new Date(lastRunAt).getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays >= STALE_AFTER_DAYS) {
    return { label: 'Нужно обновить', tone: 'status--stale' };
  }
  return { label: 'Есть данные', tone: 'status--fresh' };
};

export const createShieldScreen = () => {
  const container = document.createElement('div');
  container.className = 'screen shield';

  const header = document.createElement('header');
  header.className = 'screen-header';

  const title = document.createElement('div');
  title.innerHTML = '<h1>Щит</h1><p>Ваш текущий индекс устойчивости и ближайшие действия.</p>';
  header.appendChild(title);

  const state = getState();
  const reports = islandRegistry.map((island) => {
    const islandState = state.islands[island.id];
    if (islandState.lastReport) return islandState.lastReport;
    try {
      return island.getReport(islandState.input);
    } catch (error) {
      reportCaughtError(error);
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

  const hasAnyReport = islandRegistry.some(
    (island) => Boolean(state.islands[island.id].lastReport)
  );
  const nextStep = document.createElement('section');
  nextStep.className = 'next-step';
  nextStep.innerHTML = hasAnyReport
    ? `
      <h2>Что дальше?</h2>
      <p>Продолжайте путь: проверьте устойчивость к рискам и диверсификацию.</p>
      <div class="next-step-actions">
        <a class="button" href="#/island/hmm">Запустить стресс-тест</a>
        <a class="button ghost" href="#/island/optimization">Портфель доходов</a>
      </div>
    `
    : `
      <h2>Что дальше?</h2>
      <p>Сначала заполните базовые данные, чтобы получить первый осмысленный индекс.</p>
      <div class="next-step-actions">
        <a class="button" href="#/island/bayes">Заполнить базовые данные</a>
        <a class="button ghost" href="#/islands">Открыть острова</a>
      </div>
    `;

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
  `;

  const quests = document.createElement('section');
  quests.className = 'shield-quests';
  quests.innerHTML = `
    <h2>Следующая задача</h2>
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
            <a class="button small" href="#/island/${dailyQuest.sourceId}">Открыть остров</a>
          </div>
        </div>
      `
          : `
        <div class="quest-card">
          <div class="quest-title">Пока нет данных</div>
          <div class="quest-action">Откройте остров и заполните базовую форму.</div>
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
      <span class="tile-status status--fresh">Индекс дня</span>
      <div class="tile-score">${clampMetric(verdict.globalScore)}</div>
      <div class="tile-confidence">${clampMetric(verdict.globalConfidence)}%</div>
      <div class="tile-headline">${verdict.mood}</div>
      <div class="tile-progress">
        <span>Уровень: ${verdict.rank}</span>
        <span>Риск-хаос: ${Math.round(verdict.chaos * 100)}%</span>
      </div>
      <div class="tile-next">${
        verdict.isHighRisk || verdict.isHighUncertainty
          ? 'Сфокусируйтесь на снижении неопределённости.'
          : 'Поддерживайте текущий темп и обновляйте данные.'
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
    const nextStepLabel =
      report?.actions?.[0]?.title ?? 'Открыть модуль и запустить расчёт';
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
      <div class="tile-next">Следующий шаг: ${nextStepLabel}</div>
    `;

    grid.appendChild(tile);
  });

  const actions = document.createElement('div');
  actions.className = 'screen-actions';
  actions.innerHTML = `
    <a class="button ghost" href="#/islands">Все острова</a>
    <a class="button" href="#/settings">Настройки</a>
  `;

  container.append(header, nextStep, summary, xpBlock, quests, grid, actions);
  return container;
};
