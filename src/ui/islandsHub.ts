import { islandRegistry } from '../core/registry';
import { getCatalogByGroup, getIslandCatalogItem } from '../core/islandsCatalog';
import { getState } from '../core/store';
import {
  buildSparklineSvg,
  formatLastRun,
  getHistoryTail,
  getIslandStatus,
  getReportSummary
} from './reportUtils';

export const createIslandsHubScreen = () => {
  const state = getState();
  const summary = getReportSummary(state);
  const container = document.createElement('div');
  container.className = 'screen islands-hub';

  const header = document.createElement('header');
  header.className = 'screen-header';

  const titleWrap = document.createElement('div');
  titleWrap.innerHTML = `
    <h1>Острова</h1>
    <p>Выберите модуль и двигайтесь шаг за шагом.</p>
    <p class="hub-meta">Результатов: ${summary.total} · Ср. индекс: ${summary.avgScore} · Последний запуск: ${formatLastRun(summary.latestRun)}</p>
  `;

  const labToggleLabel = document.createElement('label');
  labToggleLabel.className = 'islands-lab-toggle';
  labToggleLabel.innerHTML = `
    <input type="checkbox" data-lab-toggle />
    <span>Показать лабораторию</span>
  `;

  header.append(titleWrap, labToggleLabel);

  const grid = document.createElement('section');
  grid.className = 'shield-grid';

  const buildCards = (showLab: boolean) => {
    grid.innerHTML = '';
    const baseItems = getCatalogByGroup('base');
    const labItems = showLab ? getCatalogByGroup('lab') : [];
    const visibleCatalog = [...baseItems, ...labItems];

    visibleCatalog.forEach((catalogItem) => {
      const island = islandRegistry.find((entry) => entry.id === catalogItem.id);
      if (!island) return;
      const islandState = state.islands[catalogItem.id];
      const status = getIslandStatus(
        islandState.progress.lastRunAt,
        Boolean(islandState.lastReport)
      );
      const trend = getHistoryTail(state, catalogItem.id).join(' → ') || '—';

      const badge = catalogItem.badge
        ? `<span class="tile-status status--fresh">${catalogItem.badge}</span>`
        : '';

      const card = document.createElement('article');
      card.className = 'shield-tile islands-hub-card';
      card.innerHTML = `
        <span class="tile-status ${status.tone}">${status.label}</span>
        ${badge}
        <div class="tile-score">${catalogItem.displayName}</div>
        <div class="tile-headline"><strong>Зачем это:</strong> ${catalogItem.shortWhy}</div>
        <div class="tile-headline"><strong>Что нужно ввести:</strong> ${catalogItem.inputHint}</div>
        <div class="tile-headline"><strong>Что получишь:</strong> ${catalogItem.outputHint}</div>
        <div class="tile-progress">
          <span>Запусков: ${islandState.progress.runsCount}</span>
          <span>Последний запуск: ${formatLastRun(islandState.progress.lastRunAt)}</span>
        </div>
        <div class="tile-next">Динамика: ${trend}</div>
        <div class="tile-sparkline">${buildSparklineSvg(islandState.progress.history)}</div>
        <div class="tile-next"><a class="button small" href="#/island/${catalogItem.id}">Открыть</a></div>
      `;
      grid.appendChild(card);
    });
  };

  buildCards(false);

  const labToggle = labToggleLabel.querySelector<HTMLInputElement>('[data-lab-toggle]');
  labToggle?.addEventListener('change', () => {
    buildCards(Boolean(labToggle.checked));
  });

  container.append(header, grid);
  return container;
};

export const getIslandsHubVisibleIds = (showLab: boolean) => {
  const base = getCatalogByGroup('base').map((item) => item.id);
  if (!showLab) {
    return base;
  }
  return [...base, ...getCatalogByGroup('lab').map((item) => item.id)];
};

export const isIslandVisibleInHub = (islandId: string, showLab: boolean) => {
  const visible = new Set(getIslandsHubVisibleIds(showLab));
  const catalogItem = islandRegistry.find((island) => island.id === islandId);
  if (!catalogItem) {
    return false;
  }
  return visible.has(catalogItem.id);
};

export const getIslandDisplayName = (id: Parameters<typeof getIslandCatalogItem>[0]) =>
  getIslandCatalogItem(id).displayName;
