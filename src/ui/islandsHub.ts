import { islandRegistry } from '../core/registry';
import { getCatalogByGroup, getIslandCatalogItem } from '../core/islandsCatalog';
import { getState } from '../core/store';
import { t, tf } from './i18n';
import { createHelpIconButton, HelpTopicId } from './help';
import {
  buildSparklineSvg,
  formatLastRun,
  getHistoryTail,
  getIslandStatus,
  getReportSummary
} from './reportUtils';


const islandHelpTopicMap: Partial<Record<string, HelpTopicId>> = {
  snapshot: 'snapshot',
  stressTest: 'stressTest',
  incomePortfolio: 'incomePortfolio',
  timeseries: 'timeseries',
  bayes: 'bayes',
  hmm: 'hmm',
  optimization: 'optimization',
  decisionTree: 'decisionTree',
  causalDag: 'causalDag'
};

export const createIslandsHubScreen = () => {
  const state = getState();
  const summary = getReportSummary(state);
  const container = document.createElement('div');
  container.className = 'screen islands-hub';

  const header = document.createElement('header');
  header.className = 'screen-header';

  const titleWrap = document.createElement('div');
  titleWrap.innerHTML = `
    <div class="islands-hub-screen-title">
      <h1>${t('navIslands')}</h1>
    </div>
    <p>${t('islandsHubIntro')}</p>
    <p class="hub-meta">${tf('islandsHubSummary', { total: summary.total, avg: summary.avgScore, latest: formatLastRun(summary.latestRun) })}</p>
  `;

  titleWrap
    .querySelector('.islands-hub-screen-title')
    ?.append(createHelpIconButton('islandsHub'));

  const labToggleLabel = document.createElement('label');
  labToggleLabel.className = 'islands-lab-toggle';
  labToggleLabel.innerHTML = `
    <input type="checkbox" data-lab-toggle />
    <span>${t('islandsHubShowLab')}</span>
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
      const helpTopic = islandHelpTopicMap[catalogItem.id];

      const badge = catalogItem.badge
        ? `<span class="islands-hub-badge status--fresh">${catalogItem.badge}</span>`
        : '';

      const card = document.createElement('article');
      card.className = 'shield-tile islands-hub-card';
      card.innerHTML = `
        <div class="tile-header islands-hub-card-header">
          <div class="islands-hub-title-wrap">
            <div class="tile-score">${catalogItem.displayName}</div>
          </div>
          <div class="tile-meta-badges">
            <span class="tile-status tile-status--chip ${status.tone}">${status.label}</span>
            ${badge}
          </div>
        </div>
        <div class="tile-headline">${catalogItem.shortWhy}</div>
        <div class="tile-progress">
          <span>${tf('islandsHubRuns', { count: islandState.progress.runsCount })}</span>
          <span>${tf('islandsHubTrend', { trend })}</span>
        </div>
        <div class="tile-sparkline">${buildSparklineSvg(islandState.progress.history)}</div>
        <div class="tile-next"><a class="button small" href="#/island/${catalogItem.id}">${t('helpOpenModule')}</a></div>
      `;

      if (helpTopic) {
        const titleWrap = card.querySelector('.islands-hub-title-wrap');
        titleWrap?.append(createHelpIconButton(helpTopic));
      }

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
