import { downloadReport } from '../core/diagnostics';
import { islandRegistry } from '../core/registry';
import { baseIslandIds, getIslandCatalogItem } from '../core/islandsCatalog';
import { AppState, IslandId } from '../core/types';
import { getState } from '../core/store';
import { reportCaughtError } from '../core/reportError';
import {
  buildSparklineSvg,
  formatLastRun,
  getNextAction,
  getReportSummary,
  getTopMetrics
} from './reportUtils';

const copyText = async (text: string) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    reportCaughtError(error);
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch (error) {
    reportCaughtError(error);
    return false;
  }
};

const buildExecutiveSummary = (state: AppState) => {
  const reports = islandRegistry
    .map((island) => state.islands[island.id].lastReport)
    .filter(Boolean);
  const totalRuns = islandRegistry.reduce(
    (sum, island) => sum + state.islands[island.id].progress.runsCount,
    0
  );

  if (!reports.length || totalRuns === 0) {
    return [
      'Пока нет запусков, поэтому итог строится только на вводе данных.',
      'Начните с одного острова и получите первый ориентир уже после первого расчёта.',
      'После этого отчёт покажет слабые места и конкретные действия на неделю.'
    ];
  }

  const avgScore = Math.round(
    reports.reduce((sum, report) => sum + report.score, 0) / reports.length
  );
  const avgConfidence = Math.round(
    reports.reduce((sum, report) => sum + report.confidence, 0) / reports.length
  );
  const weakest = [...reports].sort((a, b) => a.score - b.score)[0];

  return [
    `Сейчас средний индекс устойчивости: ${avgScore} из 100 по ${reports.length} островам.`,
    `Надёжность выводов на уровне ${avgConfidence}%, значит данные уже полезны для решений.`,
    `Главная зона роста на неделю — «${weakest.headline}»: усилив её, вы быстрее поднимете общий результат.`
  ];
};

const pickWeakestIsland = (state: AppState): IslandId | null => {
  const weakest = islandRegistry
    .map((island) => ({ id: island.id, report: state.islands[island.id].lastReport }))
    .filter((item) => Boolean(item.report))
    .sort((a, b) => (a.report?.score ?? 0) - (b.report?.score ?? 0))[0];
  return weakest?.id ?? null;
};

const buildWeeklyLevers = (state: AppState) => {
  const levers: string[] = [];
  const weakestIsland = pickWeakestIsland(state);

  if (weakestIsland) {
    const title = getIslandCatalogItem(weakestIsland).displayName;
    levers.push(`Сделайте 1 дополнительный запуск в «${title}» и доведите индекс острова минимум до +5 пунктов.`);
  }

  const lowConfidenceIsland = islandRegistry
    .map((island) => ({ id: island.id, report: state.islands[island.id].lastReport }))
    .filter((item) => Boolean(item.report) && (item.report?.confidence ?? 0) < 65)
    .sort((a, b) => (a.report?.confidence ?? 0) - (b.report?.confidence ?? 0))[0];

  if (lowConfidenceIsland) {
    const title = getIslandCatalogItem(lowConfidenceIsland.id).displayName;
    levers.push(`Обновите исходные данные в «${title}», чтобы поднять доверие модели выше 65%.`);
  }

  if (state.streakDays < 3) {
    levers.push('Закрепите ритм: запланируйте минимум 2 запуска в разные дни этой недели.');
  }

  const totalRuns = islandRegistry.reduce(
    (sum, island) => sum + state.islands[island.id].progress.runsCount,
    0
  );
  if (totalRuns < 3) {
    levers.push('Наберите базу: выполните ещё 3 запуска в ключевых островах для устойчивого тренда.');
  }

  while (levers.length < 3) {
    levers.push('Проверьте отчёт в конце недели и зафиксируйте один шаг, который дал наибольший прирост.');
  }

  return levers.slice(0, 3);
};

const buildReportText = () => {
  const state = getState();
  const summary = getReportSummary(state);
  const executive = buildExecutiveSummary(state);
  const levers = buildWeeklyLevers(state);

  const islandBlocks = islandRegistry.map((island) => {
    const islandState = state.islands[island.id];
    const report = islandState.lastReport;
    const metrics = getTopMetrics(report).join('; ');
    return [
      `${getIslandCatalogItem(island.id).displayName}`,
      `Статус: ${report?.headline ?? 'нет данных'}`,
      `Метрики: ${metrics}`,
      `Что делать: ${getNextAction(report)}`,
      `Последний запуск: ${formatLastRun(islandState.progress.lastRunAt)}`
    ].join('\n');
  });

  return [
    'Life-Shield 2.0 — Последний отчёт',
    summary.text,
    ...executive,
    '3 рычага на неделю:',
    ...levers.map((lever, index) => `${index + 1}. ${lever}`),
    ...islandBlocks
  ].join('\n\n');
};

export const createReportScreen = () => {
  const state = getState();
  const summary = getReportSummary(state);
  const executive = buildExecutiveSummary(state);
  const levers = buildWeeklyLevers(state);

  const container = document.createElement('div');
  container.className = 'screen report-screen';

  const header = document.createElement('header');
  header.className = 'screen-header';
  header.innerHTML = `
    <div>
      <h1>Последний отчёт</h1>
      <p>${summary.text}</p>
    </div>
  `;

  const executiveCard = document.createElement('section');
  executiveCard.className = 'quest-card';
  executiveCard.innerHTML = `
    <div class="quest-title">Резюме</div>
    <div class="tile-headline">${executive[0]}</div>
    <div class="tile-headline">${executive[1]}</div>
    <div class="tile-headline">${executive[2]}</div>
    <div class="quest-title">3 рычага на неделю</div>
    <ol class="report-metrics">
      ${levers.map((lever) => `<li>${lever}</li>`).join('')}
    </ol>
  `;

  const actions = document.createElement('div');
  actions.className = 'screen-actions';
  actions.innerHTML = `
    <button class="button" data-action="copy">Скопировать текст</button>
    <button class="button ghost" data-action="download">Скачать JSON</button>
    <span class="report-status" data-status></span>
  `;

  const status = actions.querySelector('[data-status]') as HTMLSpanElement;
  const textPayload = buildReportText();

  actions.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const action = target.getAttribute('data-action');
    if (!action) return;

    if (action === 'copy') {
      const ok = await copyText(textPayload);
      status.textContent = ok ? 'Скопировано.' : 'Не удалось скопировать.';
      window.setTimeout(() => {
        status.textContent = '';
      }, 1800);
      return;
    }

    if (action === 'download') {
      downloadReport(
        JSON.stringify({ exportedAt: new Date().toISOString(), state }, null, 2),
        'life-shield-report'
      );
      status.textContent = 'JSON скачан.';
      window.setTimeout(() => {
        status.textContent = '';
      }, 1800);
    }
  });



  const nextBaseGroup = document.createElement('section');
  nextBaseGroup.className = 'quest-card';
  nextBaseGroup.innerHTML = `
    <div class="quest-title">Что дальше?</div>
    <div class="tile-headline">Начните или продолжайте базовые острова, чтобы держать стабильный прогресс.</div>
    <div class="screen-actions">
      ${baseIslandIds.map((id) => `<a class="button ghost" href="#/island/${id}">${getIslandCatalogItem(id).displayName}</a>`).join('')}
    </div>
  `;

  const grid = document.createElement('section');
  grid.className = 'shield-grid';

  islandRegistry.forEach((island) => {
    const islandState = state.islands[island.id];
    const report = islandState.lastReport;
    const card = document.createElement('article');
    card.className = 'shield-tile report-card';
    card.innerHTML = `
      <div class="tile-score">${getIslandCatalogItem(island.id).displayName}</div>
      <div class="tile-headline">${getIslandCatalogItem(island.id).shortWhy}</div>
      <div class="tile-headline">${report?.headline ?? 'Нет данных'}</div>
      <ul class="report-metrics">
        ${getTopMetrics(report)
          .slice(0, 2)
          .map((metric) => `<li>${metric}</li>`)
          .join('')}
      </ul>
      <div class="tile-progress">
        <span>Последний запуск: ${formatLastRun(islandState.progress.lastRunAt)}</span>
        <span>Запусков: ${islandState.progress.runsCount}</span>
      </div>
      <div class="tile-next">Следующий шаг: ${getNextAction(report)}</div>
      <div class="tile-sparkline">${buildSparklineSvg(islandState.progress.history)}</div>
    `;
    grid.appendChild(card);
  });

  container.append(header, executiveCard, actions, nextBaseGroup, grid);
  return container;
};
