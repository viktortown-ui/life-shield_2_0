import { islandRegistry } from '../core/registry';
import { baseIslandIds, getIslandCatalogItem } from '../core/islandsCatalog';
import { AppState, IslandReport } from '../core/types';
import { getState } from '../core/store';
import { buildGlobalVerdict } from '../core/verdict';
import { createAvatar } from './avatar';
import { deriveShieldTiles } from '../core/shieldModel';
import {
  buildSparklineSvg,
  clampMetric,
  formatLastRun,
  getHistoryTail,
  getIslandStatus
} from './reportUtils';

const XP_PER_LEVEL = 120;

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

const getTotalRuns = (state: AppState) =>
  islandRegistry.reduce(
    (sum, island) => sum + state.islands[island.id].progress.runsCount,
    0
  );

const hasAnyInput = (state: AppState) =>
  islandRegistry.some((island) => state.islands[island.id].input.trim().length > 0);

export const resolvePrimaryPath = (state: AppState) => {
  const totalRuns = getTotalRuns(state);

  if (totalRuns > 0) {
    return {
      label: 'Открыть отчёт',
      href: '#/report',
      hint: 'Все ключевые выводы и следующие шаги уже готовы.'
    };
  }

  if (state.flags.onboarded || state.flags.demoLoaded || hasAnyInput(state)) {
    return {
      label: 'Запустить анализ',
      href: '#/islands',
      hint: 'Данные есть. Запустите первый расчёт в любом острове.'
    };
  }

  return {
    label: 'Заполнить данные',
    href: '#/finance',
    hint: 'Начните с базовых данных, чтобы получить первый результат.'
  };
};

export const createShieldScreen = () => {
  const container = document.createElement('div');
  container.className = 'screen shield';

  const header = document.createElement('header');
  header.className = 'screen-header';

  const title = document.createElement('div');
  title.innerHTML = '<h1>Щит</h1><p>Понятный статус, приоритет на сегодня и один следующий шаг.</p>';
  header.appendChild(title);

  const state = getState();
  const reports = islandRegistry
    .map((island) => state.islands[island.id].lastReport)
    .filter((report): report is IslandReport => Boolean(report));
  const normalizedReports = reports.map((report) => normalizeReport(report));
  const verdict = buildGlobalVerdict(normalizedReports);
  const reportById = new Map(normalizedReports.map((report) => [report.id, report]));
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

  const primaryPath = resolvePrimaryPath(state);
  const nextStep = document.createElement('section');
  nextStep.className = 'next-step';
  nextStep.innerHTML = `
      <h2>Главный путь</h2>
      <p>${primaryPath.hint}</p>
      <div class="next-step-actions">
        <a class="button button-primary-large" href="${primaryPath.href}">${primaryPath.label}</a>
      </div>
    `;

  const statusGroup = document.createElement('section');
  statusGroup.className = 'shield-group';
  statusGroup.innerHTML = '<h2 class="group-title">Статус</h2>';

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
    <h3>Прогресс уровня</h3>
    <div class="xp-meta">
      <span>Level ${state.level}</span>
      <span>${levelProgress}/${XP_PER_LEVEL} XP</span>
    </div>
    <div class="xp-bar">
      <div class="xp-bar-fill" style="width: ${levelPercent}%"></div>
    </div>
  `;

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

  statusGroup.append(summary, xpBlock, verdictTile);

  const todayGroup = document.createElement('section');
  todayGroup.className = 'shield-group';
  todayGroup.innerHTML = '<h2 class="group-title">Сегодня</h2>';

  const quests = document.createElement('section');
  quests.className = 'shield-quests';
  quests.innerHTML = `
    <div class="quest-list">
      ${
        dailyQuest
          ? `
        <div class="quest-card">
          <div class="quest-title">${dailyQuest.title}</div>
          <div class="quest-why">Зачем: ${dailyQuest.why}</div>
          <div class="quest-action">Что сделать: ${dailyQuest.action}</div>
          <div class="quest-footer">
            <span>+${dailyQuest.rewardXp} XP</span>
            <a class="button small" href="#/island/${dailyQuest.sourceId}">Открыть</a>
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
  todayGroup.appendChild(quests);


  const shieldTilesGroup = document.createElement('section');
  shieldTilesGroup.className = 'shield-group';
  shieldTilesGroup.innerHTML = '<h2 class="group-title">6 плиток Щита</h2>';

  const shieldTilesGrid = document.createElement('section');
  shieldTilesGrid.className = 'shield-grid';
  const shieldTiles = deriveShieldTiles(state);
  shieldTilesGrid.innerHTML = shieldTiles
    .map(
      (tile) => `
        <article class="shield-tile">
          <div class="tile-header">
            <div class="tile-score">${tile.title}</div>
            <span class="tile-status tile-status--chip status--fresh">${tile.source}</span>
          </div>
          <div class="tile-progress"><span>Индекс: ${tile.score}</span></div>
          <div class="tile-next">${tile.summary}</div>
        </article>
      `
    )
    .join('');
  shieldTilesGroup.appendChild(shieldTilesGrid);

  const islandsGroup = document.createElement('section');
  islandsGroup.className = 'shield-group';
  islandsGroup.innerHTML = '<h2 class="group-title">Острова</h2>';

  const grid = document.createElement('section');
  grid.className = 'shield-grid';

  const renderHeavyIslandBits = () => {
    islandRegistry.forEach((island) => {
      const tile = grid.querySelector<HTMLElement>(`[data-island-id="${island.id}"]`);
      if (!tile) return;
      const islandState = state.islands[island.id];
      const report = reportById.get(island.id) ?? islandState.lastReport;
      const nextStepLabel =
        report?.actions?.[0]?.title ?? 'Открыть остров и запустить анализ';
      const sparkline = tile.querySelector<HTMLElement>('[data-sparkline]');
      if (sparkline) {
        sparkline.innerHTML = buildSparklineSvg(islandState.progress.history);
      }
      const next = tile.querySelector<HTMLElement>('[data-next-step]');
      if (next) {
        next.textContent = `Следующий шаг: ${nextStepLabel}`;
      }
    });
  };

  islandRegistry.forEach((island) => {
    const tile = document.createElement('a');
    tile.className = 'shield-tile';
    tile.href = `#/island/${island.id}`;
    tile.dataset.islandId = island.id;

    const islandState = state.islands[island.id];
    const report = reportById.get(island.id) ?? islandState.lastReport;
    const score = clampMetric(report?.score ?? 0);
    const confidence = clampMetric(report?.confidence ?? 0);
    const progress = islandState.progress;
    const catalog = getIslandCatalogItem(island.id);
    const status = getIslandStatus(progress.lastRunAt, Boolean(report));

    tile.innerHTML = `
      <span class="tile-status ${status.tone}">${status.label}</span>
      <div class="tile-score">${catalog.displayName}</div>
      <div class="tile-progress">
        <span>Индекс: ${score}</span>
        <span>Доверие: ${confidence}%</span>
        <span>Запусков: ${progress.runsCount}</span>
      </div>
      <div class="tile-sparkline" data-sparkline>Загрузка динамики…</div>
      <div class="tile-next" data-next-step>Подготовка подсказки…</div>
    `;

    grid.appendChild(tile);
  });
  islandsGroup.appendChild(grid);

  const scheduleHeavyRender = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => renderHeavyIslandBits(), { timeout: 1200 });
      return;
    }
    window.setTimeout(renderHeavyIslandBits, 0);
  };
  scheduleHeavyRender();

  const historyGroup = document.createElement('section');
  historyGroup.className = 'shield-group';
  historyGroup.innerHTML = '<h2 class="group-title">История</h2>';

  const historyList = document.createElement('div');
  historyList.className = 'quest-list';
  const latestRuns = islandRegistry
    .map((island) => ({
      id: island.id,
      title: getIslandCatalogItem(island.id).displayName,
      lastRunAt: state.islands[island.id].progress.lastRunAt,
      trail: ''
    }))
    .filter((item) => Boolean(item.lastRunAt))
    .sort((a, b) => (b.lastRunAt ?? '').localeCompare(a.lastRunAt ?? ''))
    .slice(0, 4);

  if (latestRuns.length === 0) {
    historyList.innerHTML = `
      <article class="quest-card">
        <div class="quest-title">Запусков пока нет</div>
        <div class="quest-action">После первого анализа здесь появится короткая история изменений.</div>
      </article>
    `;
  } else {
    historyList.innerHTML = latestRuns
      .map(
        (item) => `
          <article class="quest-card">
            <div class="quest-title">${item.title}</div>
            <div class="quest-action">Последний запуск: ${formatLastRun(item.lastRunAt)}</div>
            <div class="tile-next" data-history-id="${item.id}">Динамика: загрузка…</div>
          </article>
        `
      )
      .join('');
  }
  historyGroup.appendChild(historyList);

  const renderHistoryTrails = () => {
    latestRuns.forEach((item) => {
      const target = historyList.querySelector<HTMLElement>(
        `[data-history-id="${item.id}"]`
      );
      if (!target) return;
      const trail = getHistoryTail(state, item.id).join(' → ') || '—';
      target.textContent = `Динамика: ${trail}`;
    });
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => renderHistoryTrails(), { timeout: 1600 });
  } else {
    window.setTimeout(renderHistoryTrails, 16);
  }



  const nextBaseGroup = document.createElement('section');
  nextBaseGroup.className = 'shield-group';
  nextBaseGroup.innerHTML = '<h2 class="group-title">Что дальше?</h2>';

  const nextBaseLinks = document.createElement('div');
  nextBaseLinks.className = 'screen-actions';
  nextBaseLinks.innerHTML = baseIslandIds
    .map((id) => `<a class="button ghost" href="#/island/${id}">${getIslandCatalogItem(id).displayName}</a>`)
    .join('');
  nextBaseGroup.appendChild(nextBaseLinks);

  const actions = document.createElement('div');
  actions.className = 'screen-actions';
  actions.innerHTML = `
    <a class="button ghost" href="#/finance">Финансы</a>
    <a class="button ghost" href="#/islands">Все острова</a>
    <a class="button ghost" href="#/report">Отчёт</a>
    <a class="button" href="#/settings">Настройки</a>
  `;

  container.append(
    header,
    nextStep,
    statusGroup,
    todayGroup,
    shieldTilesGroup,
    islandsGroup,
    historyGroup,
    nextBaseGroup,
    actions
  );
  return container;
};
