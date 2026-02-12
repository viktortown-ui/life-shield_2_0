import { downloadReport } from '../core/diagnostics';
import { islandRegistry } from '../core/registry';
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

const buildReportText = () => {
  const state = getState();
  const summary = getReportSummary(state);

  const islandBlocks = islandRegistry.map((island) => {
    const islandState = state.islands[island.id];
    const report = islandState.lastReport;
    const metrics = getTopMetrics(report).join('; ');
    return [
      `${island.title}`,
      `Статус: ${report?.headline ?? 'нет данных'}`,
      `Метрики: ${metrics}`,
      `Что делать: ${getNextAction(report)}`,
      `Последний запуск: ${formatLastRun(islandState.progress.lastRunAt)}`
    ].join('\n');
  });

  return [
    'Life-Shield 2.0 — Последний отчёт',
    summary.text,
    ...islandBlocks
  ].join('\n\n');
};

export const createReportScreen = () => {
  const state = getState();
  const summary = getReportSummary(state);

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

  const grid = document.createElement('section');
  grid.className = 'shield-grid';

  islandRegistry.forEach((island) => {
    const islandState = state.islands[island.id];
    const report = islandState.lastReport;
    const card = document.createElement('article');
    card.className = 'shield-tile report-card';
    card.innerHTML = `
      <div class="tile-score">${island.title}</div>
      <div class="tile-headline">${report?.headline ?? 'Нет данных'}</div>
      <ul class="report-metrics">
        ${getTopMetrics(report)
          .map((metric) => `<li>${metric}</li>`)
          .join('')}
      </ul>
      <div class="tile-next">Что делать дальше: ${getNextAction(report)}</div>
      <div class="tile-progress">
        <span>Последний запуск: ${formatLastRun(islandState.progress.lastRunAt)}</span>
      </div>
      <div class="tile-sparkline">${buildSparklineSvg(islandState.progress.history)}</div>
    `;
    grid.appendChild(card);
  });

  container.append(header, actions, grid);
  return container;
};
