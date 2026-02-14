import { islandRegistry } from '../core/registry';
import { getIslandCatalogItem } from '../core/islandsCatalog';
import { deriveShieldTiles } from '../core/shieldModel';
import { getState, recordCosmosEvent, setCosmosUiFlags } from '../core/store';
import { CosmosActivityEvent, IslandId, IslandReport } from '../core/types';
import { createCosmosSfxEngine } from './cosmosSfx';
import { formatNumber, t } from './i18n';
import { computeTurbulence } from '../core/turbulence';
import {
  getTurbulenceScore,
  getUncertaintyLabel,
  MC_RISK_BADGE_THRESHOLD
} from './cosmosTurbulence';

type OrbitId = 'money' | 'obligations' | 'income' | 'energy' | 'support' | 'flexibility';
type PlanetRefId = IslandId | 'history';

type PlanetBadge = 'ok' | 'risk' | 'none';

interface PlanetConfig {
  id: PlanetRefId;
  orbitId: OrbitId;
  angleDeg: number;
  distanceFactor: number;
  dataHref?: string;
  reportHref?: string;
}

interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

interface PlanetInstrumentStatus {
  id: PlanetRefId;
  badge: PlanetBadge;
  riskSeverity: number;
  confidence: number | null;
  freshnessUrgency: number;
  proximityUrgency: number;
  turbulence: number | null;
}

const PLANETS: PlanetConfig[] = [
  { id: 'snapshot', orbitId: 'money', angleDeg: 20, distanceFactor: 0.8, dataHref: '#/finance', reportHref: '#/report' },
  { id: 'stressTest', orbitId: 'obligations', angleDeg: 96, distanceFactor: 0.86, dataHref: '#/finance', reportHref: '#/report' },
  { id: 'incomePortfolio', orbitId: 'income', angleDeg: 162, distanceFactor: 0.88, dataHref: '#/finance', reportHref: '#/report' },
  { id: 'bayes', orbitId: 'energy', angleDeg: 212, distanceFactor: 0.72, reportHref: '#/report' },
  { id: 'hmm', orbitId: 'energy', angleDeg: 254, distanceFactor: 0.9, reportHref: '#/report' },
  { id: 'timeseries', orbitId: 'support', angleDeg: 302, distanceFactor: 0.76, reportHref: '#/report' },
  { id: 'optimization', orbitId: 'flexibility', angleDeg: 342, distanceFactor: 0.9, reportHref: '#/report' },
  { id: 'decisionTree', orbitId: 'support', angleDeg: 42, distanceFactor: 0.94, reportHref: '#/report' },
  { id: 'causalDag', orbitId: 'obligations', angleDeg: 136, distanceFactor: 0.68, reportHref: '#/report' },
  { id: 'history', orbitId: 'income', angleDeg: 196, distanceFactor: 0.76, dataHref: '#/history' }
];

const ORBIT_RADIUS: Record<OrbitId, number> = {
  money: 72,
  obligations: 104,
  income: 136,
  energy: 168,
  support: 200,
  flexibility: 232
};

const ORBIT_LABELS: Record<OrbitId, string> = {
  money: 'Финансы',
  obligations: 'Обязательства',
  income: 'Доход',
  energy: 'Энергия',
  support: 'Поддержка',
  flexibility: 'Гибкость'
};

const FALLBACK_IMPORTANT: PlanetRefId[] = PLANETS.slice(0, 7).map((planet) => planet.id);
const VIEWBOX_SIZE = 520;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3.2;
const PAN_MARGIN = 80;
const STALE_AFTER_DAYS = 7;
const TRAIL_WINDOW_DAYS = 7;
const TRAIL_DOT_MAX = 5;
const RECENT_ACTION_LIMIT = 5;
const COMET_INTERVAL_MS = 9000;
const HOLD_DELAY_MS = 210;
const DEADZONE_RADIUS = 12;
const ACTIVATION_RADIUS = 22;
const SPARK_DURATION_MS = 430;
const SPARK_MIN = 6;
const SPARK_MAX = 12;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const toPoint = (angleDeg: number, radius: number) => {
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: 260 + Math.cos(angleRad) * radius,
    y: 260 + Math.sin(angleRad) * radius
  };
};

const inferRiskSeverity = (report: IslandReport | null) => {
  if (!report) return 0;
  const scoreRisk = clamp01((65 - report.score) / 40);
  const insightRisk = report.insights?.some((item) => item.severity === 'risk') ? 1 : 0;
  return Math.max(scoreRisk, insightRisk);
};

const inferConfidence = (report: IslandReport | null, input: string) => {
  if (report) return Math.max(0, Math.min(100, Math.round(report.confidence)));
  return input.trim().length > 0 ? 45 : null;
};

const inferFreshnessUrgency = (lastRunAt: string | null) => {
  if (!lastRunAt) return 1;
  const diffDays = (Date.now() - new Date(lastRunAt).getTime()) / (1000 * 60 * 60 * 24);
  return clamp01(diffDays / STALE_AFTER_DAYS);
};

const inferBadge = (hasReport: boolean, riskSeverity: number): PlanetBadge => {
  if (!hasReport) return 'none';
  return riskSeverity >= 0.42 ? 'risk' : 'ok';
};



const DAY_MS = 1000 * 60 * 60 * 24;

const getRecentPlanetEvents = (
  log: CosmosActivityEvent[],
  islandId: IslandId,
  max: number
) => log.filter((event) => event.islandId === islandId).slice(-max).reverse();

const getTrailStats = (log: CosmosActivityEvent[], islandId: IslandId) => {
  const now = Date.now();
  const recent = log.filter((event) => {
    if (event.islandId !== islandId) return false;
    const ts = new Date(event.ts).getTime();
    if (!Number.isFinite(ts)) return false;
    return now - ts <= TRAIL_WINDOW_DAYS * DAY_MS;
  });
  const count = Math.min(TRAIL_DOT_MAX, recent.length);
  const latestTs = recent.length ? new Date(recent.at(-1)!.ts).getTime() : 0;
  const freshness = latestTs ? clamp01(1 - (now - latestTs) / (TRAIL_WINDOW_DAYS * DAY_MS)) : 0;
  return { count, freshness };
};

const formatEventAction = (action: CosmosActivityEvent['action']) => {
  if (action === 'open') return 'Открыт остров';
  if (action === 'data') return 'Переход в данные';
  if (action === 'report') return 'Переход к отчёту';
  if (action === 'confirm') return 'Подтверждено действие';
  return 'Отмена';
};

const formatEventAge = (ts: string) => {
  const diffMs = Date.now() - new Date(ts).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'только что';
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes}м назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}ч назад`;
  return `${Math.floor(hours / 24)}д назад`;
};

const TURBULENCE_RISK_THRESHOLD = 0.5;
const FORECAST_RISK_BADGE_THRESHOLD = 0.5;

const getDisagreementLabel = (score: number) => {
  if (score >= 0.66) return 'низкое';
  if (score >= 0.33) return 'среднее';
  return 'высокое';
};

const formatMonths = (value: number) => `${value.toFixed(1)} мес`;

const formatDateTime = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
};

export const createCosmosScreen = () => {
  const state = getState();
  const turbulence = computeTurbulence(state);
  const turbulenceSignalById = new Map(turbulence.signals.map((signal) => [signal.id, signal]));
  const tiles = deriveShieldTiles(state);
  const orbitTitleById = new Map(tiles.map((tile) => [tile.id, tile.title]));

  const statuses = PLANETS.reduce((acc, planet) => {
    const maxRadius = Math.max(...Object.values(ORBIT_RADIUS));
    const proximityUrgency = clamp01(1 - (ORBIT_RADIUS[planet.orbitId] * planet.distanceFactor) / maxRadius);

    if (planet.id === 'history') {
      const count = state.observations.cashflowMonthly.length;
      const historyScore = Math.max(
        Number(turbulenceSignalById.get('cashflowDrift')?.score ?? 0),
        Number(turbulenceSignalById.get('cashflowForecast')?.score ?? 0)
      );
      acc.set('history', {
        id: 'history',
        badge: count === 0 ? 'none' : historyScore >= TURBULENCE_RISK_THRESHOLD ? 'risk' : 'ok',
        riskSeverity: historyScore,
        confidence: count > 0 ? 100 : null,
        freshnessUrgency: count > 0 ? 0.2 : 1,
        proximityUrgency,
        turbulence: count > 0 ? historyScore : null
      });
      return acc;
    }

    const islandState = state.islands[planet.id];
    const riskSeverity = inferRiskSeverity(islandState.lastReport);
    const confidence = inferConfidence(islandState.lastReport, islandState.input);
    const freshnessUrgency = inferFreshnessUrgency(islandState.progress.lastRunAt);
    const mcTurbulence =
      planet.id === 'stressTest'
        ? getTurbulenceScore(islandState.mcLast, islandState.mcHistory ?? [])
        : null;
    const stressRiskBadge = planet.id === 'stressTest' && mcTurbulence ? mcTurbulence.hasRiskBadge : null;
    acc.set(planet.id, {
      id: planet.id,
      badge:
        stressRiskBadge === null
          ? inferBadge(Boolean(islandState.lastReport), riskSeverity)
          : stressRiskBadge
            ? 'risk'
            : 'ok',
      riskSeverity,
      confidence,
      freshnessUrgency,
      proximityUrgency,
      turbulence: mcTurbulence?.turbulence ?? null
    });
    return acc;
  }, new Map<PlanetRefId, PlanetInstrumentStatus>());

  const stressMc = state.islands.stressTest.mcLast;
  const hasMonteCarloStress = Boolean(stressMc);

  const scored = [...statuses.values()].map((status) => ({
    id: status.id,
    score: status.riskSeverity * 0.5 + status.freshnessUrgency * 0.35 + status.proximityUrgency * 0.15
  }));
  const hasAnyData = [...statuses.values()].some((status) => status.badge !== 'none');
  const importantPlanets = new Set<PlanetRefId>(
    hasAnyData
      ? scored.sort((a, b) => b.score - a.score).slice(0, 7).map((item) => item.id)
      : FALLBACK_IMPORTANT
  );

  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduceMotion = state.flags.cosmosReduceMotionOverride ?? mediaQuery.matches;
  const uiFlags = {
    showAllLabels: state.flags.cosmosShowAllLabels && !state.flags.cosmosOnlyImportant,
    onlyImportant: state.flags.cosmosOnlyImportant,
    showHalo: state.flags.cosmosShowHalo,
    soundFxEnabled: state.flags.cosmosSoundFxEnabled,
    sfxГромкость: state.flags.cosmosSfxГромкость,
    reduceMotion
  };
  const sfx = createCosmosSfxEngine();
  const cosmosActivityLog = state.cosmosActivityLog ?? [];

  const container = document.createElement('div');
  container.className = 'screen cosmos-screen';

  const header = document.createElement('header');
  header.className = 'screen-header';
  header.innerHTML = `
    <div>
      <h1>${t('cosmosTitle')}</h1>
      <p>Карта приоритетов островов: фокус на рисках, свежести и турбулентности.</p>
    </div>
  `;

  const viewSettingsToggle = document.createElement('button');
  viewSettingsToggle.type = 'button';
  viewSettingsToggle.className = 'button ghost small cosmos-view-toggle';
  viewSettingsToggle.textContent = t('viewSettings');
  viewSettingsToggle.setAttribute('aria-expanded', 'false');

  const controls = document.createElement('section');
  controls.className = 'cosmos-controls';
  controls.innerHTML = `
    <section class="cosmos-controls-group">
      <h3>Вид и фильтры / View & filters</h3>
      <label><input type="checkbox" data-flag="showAllLabels" data-testid="cosmos-toggle-showAllLabels" aria-label="Показывать все подписи планет" ${uiFlags.showAllLabels ? 'checked' : ''}/> Подписи всех планет / All labels</label>
      <label><input type="checkbox" data-flag="onlyImportant" data-testid="cosmos-toggle-onlyImportant" aria-label="Показывать только важные планеты" ${uiFlags.onlyImportant ? 'checked' : ''}/> Только важные / Important only</label>
      <label><input type="checkbox" data-flag="showHalo" data-testid="cosmos-toggle-showHalo" aria-label="Показывать halo планет" ${uiFlags.showHalo ? 'checked' : ''}/> Halo турбулентности / Turbulence halo</label>
    </section>
    <section class="cosmos-controls-group">
      <h3>Эффекты / Effects</h3>
      <label><input type="checkbox" data-flag="soundFx" data-testid="cosmos-toggle-soundFx" aria-label="Включить Звуковые эффекты в Cosmos" ${uiFlags.soundFxEnabled ? 'checked' : ''}/> ${t('soundFx')}</label>
      <label>${t('volume')} <input type="range" data-flag="sfxГромкость" data-testid="cosmos-toggle-sfxГромкость" min="0" max="1" step="0.05" aria-label="Громкость Звуковые эффекты в Cosmos" value="${uiFlags.sfxГромкость}" /></label>
      <label><input type="checkbox" data-flag="reduceMotion" data-testid="cosmos-toggle-reduceMotion" aria-label="Сократить анимации Cosmos" ${state.flags.cosmosReduceMotionOverride === true ? 'checked' : ''}/> ${t('reduceMotion')}</label>
      <p class="muted">prefers-reduced-motion учитывается автоматически / follows system setting.</p>
    </section>
  `;

  const viewSettingsPanel = document.createElement('section');
  viewSettingsPanel.className = 'cosmos-view-panel hidden';
  viewSettingsPanel.appendChild(controls);

  const legend = document.createElement('section');
  legend.className = 'cosmos-legend';
  legend.innerHTML = `<p>${
    hasMonteCarloStress
      ? 'Halo = прогнозная турбулентность (Монте-Карло)'
      : 'Halo = эвристика (без Монте-Карло)'
  }</p>`;
  viewSettingsPanel.appendChild(legend);

  const mapWrap = document.createElement('section');
  mapWrap.className = 'cosmos-map-wrap';

  const map = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  map.setAttribute('viewBox', '0 0 520 520');
  map.setAttribute('class', 'cosmos-map');
  map.setAttribute('role', 'img');
  map.setAttribute('aria-label', 'Карта островов в космосе');
  map.style.touchAction = 'none';

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <radialGradient id="planetGradient" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#7ef7e6" />
      <stop offset="100%" stop-color="#4f8bff" />
    </radialGradient>
  `;
  map.appendChild(defs);

  const viewport = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  viewport.setAttribute('class', 'cosmos-viewport');
  map.appendChild(viewport);

  const sparkLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  sparkLayer.setAttribute('class', 'cosmos-spark-layer');
  map.appendChild(sparkLayer);

  const cometLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  cometLayer.setAttribute('class', 'cosmos-comet-layer');
  map.appendChild(cometLayer);

  const sun = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  sun.setAttribute('cx', '260');
  sun.setAttribute('cy', '260');
  sun.setAttribute('r', '20');
  sun.setAttribute('class', 'cosmos-core');
  viewport.appendChild(sun);

  (Object.keys(ORBIT_RADIUS) as OrbitId[]).forEach((orbitId) => {
    const radius = ORBIT_RADIUS[orbitId];
    const orbit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    orbit.setAttribute('cx', '260');
    orbit.setAttribute('cy', '260');
    orbit.setAttribute('r', String(radius));
    orbit.setAttribute('class', 'cosmos-orbit');
    viewport.appendChild(orbit);

    const labelPoint = toPoint(orbitId === 'money' ? -90 : -24, radius);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', labelPoint.x.toFixed(1));
    label.setAttribute('y', labelPoint.y.toFixed(1));
    label.setAttribute('class', 'cosmos-orbit-label');
    label.textContent = ORBIT_LABELS[orbitId] ?? orbitTitleById.get(orbitId) ?? orbitId;
    viewport.appendChild(label);
  });

  const resetViewButton = document.createElement('button');
  resetViewButton.type = 'button';
  resetViewButton.className = 'button ghost small cosmos-reset';
  resetViewButton.textContent = 'Сброс вида';
  resetViewButton.setAttribute('aria-label', 'Сбросить масштаб и позицию карты Cosmos');


  const activityPanel = document.createElement('section');
  activityPanel.className = 'cosmos-activity-panel';
  activityPanel.innerHTML = '<h3>Последние действия</h3><p class="muted">Выберите планету, чтобы увидеть историю.</p>';
  viewSettingsPanel.appendChild(activityPanel);

  const menu = document.createElement('div');
  menu.className = 'cosmos-menu hidden';

  const radialMenu = document.createElement('div');
  radialMenu.className = 'cosmos-radial-menu hidden';
  radialMenu.setAttribute('data-testid', 'cosmos-radial');
  radialMenu.setAttribute('role', 'menu');
  radialMenu.setAttribute('aria-label', 'Жестовое меню планеты');

  const radialCenter = document.createElement('div');
  radialCenter.className = 'cosmos-radial-center';
  radialCenter.setAttribute('aria-hidden', 'true');
  radialMenu.appendChild(radialCenter);

  const closeMenu = () => {
    menu.classList.add('hidden');
    menu.innerHTML = '';
  };

  let cometIntervalId: number | null = null;

  const menuState = { labelBox: null as DOMRect | null };

  type PlanetAction = {
    id: string;
    label: string;
    href?: string;
    onSelect?: () => void;
  };

  const buildPlanetActions = (config: PlanetConfig): PlanetAction[] => {
    const hasResult = config.id === 'history' ? false : Boolean(state.islands[config.id]?.lastReport);
    const actions: PlanetAction[] = [
      { id: 'open', label: 'Открыть', href: config.id === 'history' ? '#/history' : `#/island/${config.id}` }
    ];
    if (config.dataHref) {
      actions.push({ id: 'data', label: 'Данные', href: config.dataHref });
    }
    if (config.reportHref && hasResult) {
      actions.push({ id: 'report', label: 'Результат', href: config.reportHref });
    }
    actions.push({ id: 'close', label: 'Отмена', onSelect: closeMenu });
    return actions;
  };

  const runPlanetAction = (planetId: PlanetRefId, action: PlanetAction) => {
    if (action.id === 'close') {
      if (planetId !== 'history') recordCosmosEvent(planetId, 'cancel');
    } else if (action.id === 'open' || action.id === 'data' || action.id === 'report') {
      if (planetId !== 'history') recordCosmosEvent(planetId, action.id);
    }
    if (action.onSelect) {
      action.onSelect();
      return;
    }
    if (action.href) {
      window.location.hash = action.href;
    }
  };

  const playSfx = (tone: 'select' | 'menuOpen' | 'confirm' | 'cancel') => {
    if (!uiFlags.soundFxEnabled) return;
    sfx.play(tone, uiFlags.sfxГромкость);
  };

  const triggerSparkBurst = (x: number, y: number) => {
    if (uiFlags.reduceMotion) return;
    const count = Math.floor(Math.random() * (SPARK_MAX - SPARK_MIN + 1)) + SPARK_MIN;
    for (let i = 0; i < count; i += 1) {
      const spark = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      spark.setAttribute('cx', x.toFixed(1));
      spark.setAttribute('cy', y.toFixed(1));
      spark.setAttribute('r', String(1.5 + Math.random() * 1.8));
      spark.setAttribute('class', 'cosmos-spark');
      const angle = Math.random() * Math.PI * 2;
      const distance = 18 + Math.random() * 24;
      spark.style.setProperty('--spark-dx', `${Math.cos(angle) * distance}px`);
      spark.style.setProperty('--spark-dy', `${Math.sin(angle) * distance}px`);
      spark.style.animationDuration = `${SPARK_DURATION_MS - Math.random() * 120}ms`;
      sparkLayer.appendChild(spark);
      window.setTimeout(() => spark.remove(), SPARK_DURATION_MS + 140);
    }
  };

  const spawnComet = () => {
    if (uiFlags.reduceMotion) return;
    const comet = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    comet.setAttribute('class', 'cosmos-comet');
    const startX = 40 + Math.random() * 440;
    const startY = 30 + Math.random() * 460;
    comet.setAttribute('x1', startX.toFixed(1));
    comet.setAttribute('y1', startY.toFixed(1));
    comet.setAttribute('x2', (startX + 18).toFixed(1));
    comet.setAttribute('y2', (startY + 10).toFixed(1));
    comet.style.setProperty('--comet-dx', `${24 + Math.random() * 38}px`);
    comet.style.setProperty('--comet-dy', `${10 + Math.random() * 24}px`);
    comet.style.animationDuration = `${880 + Math.random() * 540}ms`;
    cometLayer.appendChild(comet);
    window.setTimeout(() => comet.remove(), 1700);
  };

  const clearCometInterval = () => {
    if (cometIntervalId != null) {
      window.clearInterval(cometIntervalId);
      cometIntervalId = null;
    }
  };

  const startCometInterval = () => {
    clearCometInterval();
    if (uiFlags.reduceMotion) return;
    cometIntervalId = window.setInterval(spawnComet, COMET_INTERVAL_MS);
  };

  const unlockAudioFromGesture = () => {
    if (!uiFlags.soundFxEnabled) return;
    if (sfx.isUnlocked()) {
      sfx.resume().catch(() => undefined);
      return;
    }
    sfx.unlock().catch(() => undefined);
  };

  const placeMenu = (x: number, y: number) => {
    const wrapRect = mapWrap.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const gap = 12;
    let left = x;
    let top = y;

    left = Math.min(Math.max(left, menuRect.width / 2 + gap), wrapRect.width - menuRect.width / 2 - gap);
    top = Math.min(Math.max(top, menuRect.height / 2 + gap), wrapRect.height - menuRect.height / 2 - gap);

    if (menuState.labelBox) {
      const l = menuState.labelBox;
      const menuBox = {
        left: left - menuRect.width / 2,
        right: left + menuRect.width / 2,
        top: top - menuRect.height / 2,
        bottom: top + menuRect.height / 2
      };
      const intersects = !(menuBox.left > l.right || menuBox.right < l.left || menuBox.top > l.bottom || menuBox.bottom < l.top);
      if (intersects) {
        top = Math.max(menuRect.height / 2 + gap, Math.min(wrapRect.height - menuRect.height / 2 - gap, l.bottom + menuRect.height / 2 + gap));
      }
    }

    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
  };

  const openMenu = (config: PlanetConfig, x: number, y: number) => {
    playSfx('menuOpen');
    const catalogItem = config.id === 'history' ? null : getIslandCatalogItem(config.id);
    const actionsList = buildPlanetActions(config);
    menu.classList.remove('hidden');
    menu.innerHTML = '';

    const title = document.createElement('strong');
    title.textContent = catalogItem?.displayName ?? "История";

    const actions = document.createElement('div');
    actions.className = 'cosmos-menu-actions';
    actionsList.forEach((action) => {
      if (action.href) {
        const link = document.createElement('a');
        link.className = `button small ${action.id === 'open' ? '' : 'ghost'}`.trim();
        link.href = action.href;
        link.textContent = action.label;
        link.setAttribute('aria-label', `${catalogItem?.displayName ?? "История"}: ${action.label}`);
        link.addEventListener('click', () => {
          playSfx('confirm');
          const point = planetPoints.get(config.id);
          if (point) triggerSparkBurst(point.x, point.y);
        });
        actions.appendChild(link);
      } else {
        const button = document.createElement('button');
        button.className = 'button small ghost';
        button.type = 'button';
        button.textContent = action.label;
        button.setAttribute('aria-label', `${catalogItem?.displayName ?? "История"}: ${action.label}`);
        button.addEventListener('click', () => {
          playSfx(action.id === 'close' ? 'cancel' : 'confirm');
          if (action.id !== 'close') {
            const point = planetPoints.get(config.id);
            if (point) triggerSparkBurst(point.x, point.y);
          }
          runPlanetAction(config.id, action);
        });
        actions.appendChild(button);
      }
    });

    menu.append(title, actions);
    requestAnimationFrame(() => placeMenu(x, y));
  };

  type RadialSession = {
    planet: PlanetConfig;
    centerX: number;
    centerY: number;
    pointerId: number;
    actions: PlanetAction[];
    selectedIndex: number;
  };

  const radialState: {
    active: RadialSession | null;
    items: HTMLElement[];
    suppressClickFor: PlanetRefId | null;
  } = {
    active: null,
    items: [],
    suppressClickFor: null
  };

  const closeRadialMenu = () => {
    radialState.active = null;
    radialMenu.classList.add('hidden');
    radialMenu.classList.remove('is-active');
    radialState.items.forEach((item) => item.remove());
    radialState.items = [];
  };

  const clampRadialPosition = (x: number, y: number) => {
    const wrapRect = mapWrap.getBoundingClientRect();
    const radius = 74;
    return {
      x: Math.min(Math.max(x, radius), wrapRect.width - radius),
      y: Math.min(Math.max(y, radius), wrapRect.height - radius)
    };
  };

  const renderRadialItems = (actions: PlanetAction[]) => {
    radialState.items.forEach((item) => item.remove());
    radialState.items = actions.map((action) => {
      const item = document.createElement('div');
      item.className = 'cosmos-radial-item';
      item.setAttribute('role', 'menuitem');
      item.setAttribute('aria-label', action.label);
      item.textContent = action.label;
      radialMenu.appendChild(item);
      return item;
    });

    const count = Math.max(1, actions.length);
    radialState.items.forEach((item, index) => {
      const angle = -Math.PI / 2 + ((Math.PI * 2) / count) * index;
      const itemX = Math.cos(angle) * 58;
      const itemY = Math.sin(angle) * 58;
      item.style.transform = `translate(${itemX.toFixed(1)}px, ${itemY.toFixed(1)}px)`;
    });
  };

  const openRadialMenu = (planet: PlanetConfig, x: number, y: number, pointerId: number) => {
    playSfx('menuOpen');
    const actions = buildPlanetActions(planet);
    const clamped = clampRadialPosition(x, y);
    selectedPlanetId = planet.id;
    updateSelectionState();
    closeMenu();
    renderRadialItems(actions);
    radialState.active = {
      planet,
      centerX: clamped.x,
      centerY: clamped.y,
      pointerId,
      actions,
      selectedIndex: -1
    };
    radialMenu.style.left = `${Math.round(clamped.x)}px`;
    radialMenu.style.top = `${Math.round(clamped.y)}px`;
    radialMenu.classList.remove('hidden');
    radialMenu.classList.add('is-active');
  };

  const updateRadialSelection = (clientX: number, clientY: number) => {
    const active = radialState.active;
    if (!active) return;
    const wrapRect = mapWrap.getBoundingClientRect();
    const dx = clientX - (wrapRect.left + active.centerX);
    const dy = clientY - (wrapRect.top + active.centerY);
    const distance = Math.hypot(dx, dy);
    let selectedIndex = -1;
    if (distance >= ACTIVATION_RADIUS) {
      const angle = (Math.atan2(dy, dx) + Math.PI * 2 + Math.PI / 2) % (Math.PI * 2);
      const sectorSize = (Math.PI * 2) / active.actions.length;
      selectedIndex = Math.floor(angle / sectorSize);
    }
    active.selectedIndex = selectedIndex;
    radialState.items.forEach((item, index) => {
      item.classList.toggle('is-active', index === selectedIndex);
    });
    radialCenter.classList.toggle('is-idle', distance < DEADZONE_RADIUS);
  };

  const clampTransform = (next: ViewTransform): ViewTransform => {
    const minPan = VIEWBOX_SIZE - VIEWBOX_SIZE * next.scale - PAN_MARGIN;
    const maxPan = PAN_MARGIN;
    return {
      x: Math.max(minPan, Math.min(maxPan, next.x)),
      y: Math.max(minPan, Math.min(maxPan, next.y)),
      scale: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next.scale))
    };
  };

  let transform: ViewTransform = { x: 0, y: 0, scale: 1 };
  let rafPending = false;

  const renderTransform = () => {
    rafPending = false;
    viewport.setAttribute('transform', `matrix(${transform.scale} 0 0 ${transform.scale} ${transform.x} ${transform.y})`);
  };

  const queueRender = () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(renderTransform);
  };

  const setTransform = (next: ViewTransform) => {
    transform = clampTransform(next);
    queueRender();
  };

  const toSvgPoint = (clientX: number, clientY: number) => {
    const rect = map.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * VIEWBOX_SIZE,
      y: ((clientY - rect.top) / rect.height) * VIEWBOX_SIZE
    };
  };

  const zoomAroundPoint = (centerX: number, centerY: number, targetScale: number) => {
    const nextScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetScale));
    const worldX = (centerX - transform.x) / transform.scale;
    const worldY = (centerY - transform.y) / transform.scale;
    setTransform({
      scale: nextScale,
      x: centerX - worldX * nextScale,
      y: centerY - worldY * nextScale
    });
  };

  const resetView = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
    closeMenu();
    closeRadialMenu();
  };

  resetViewButton.addEventListener('click', resetView);

  let selectedPlanetId: PlanetRefId | null = null;
  const planetGroups = new Map<PlanetRefId, SVGGElement>();
  const planetPoints = new Map<PlanetRefId, { x: number; y: number }>();
  const recentEventsByPlanet = new Map<PlanetRefId, CosmosActivityEvent[]>();

  const renderActivityPanel = () => {
    if (!selectedPlanetId) {
      activityPanel.innerHTML = '<h3>Последние действия</h3><p class="muted">Выберите планету, чтобы увидеть историю.</p>';
      return;
    }
    const recent = recentEventsByPlanet.get(selectedPlanetId) ?? [];
    const title = selectedPlanetId === 'history' ? 'История' : getIslandCatalogItem(selectedPlanetId).displayName;
    const list = recent.length
      ? `<ul>${recent
          .slice(0, RECENT_ACTION_LIMIT)
          .map((event) => `<li><strong>${formatEventAction(event.action)}</strong> · ${formatEventAge(event.ts)}</li>`)
          .join('')}</ul>`
      : '<p class="muted">Нет событий за последнее время.</p>';
    const signalsList = turbulence.signals
      .slice(0, 5)
      .map((signal) => `<li><strong>${signal.label}</strong> · ${(signal.score * 100).toFixed(0)}% — ${signal.explanation}</li>`)
      .join('');
    const signalsBlock = `<section class="cosmos-forecast-block"><h4>Сигналы турбулентности</h4><p>Индекс: <strong>${(
      turbulence.overallScore * 100
    ).toFixed(0)}%</strong> · доверие ${(turbulence.overallConfidence * 100).toFixed(0)}%</p>${
      signalsList ? `<ul>${signalsList}</ul>` : '<p class="muted">Сигналы появятся после накопления данных.</p>'
    }</section>`;
    const mcForecastBlock =
      selectedPlanetId === 'stressTest'
        ? (() => {
            const mc = state.islands.stressTest.mcLast;
            if (!mc) {
              return '<section class="cosmos-forecast-block"><h4>Прогноз Монте-Карло</h4><p class="muted">Запусти Монте-Карло в Стресс-тесте.</p></section>';
            }
            const turbulence = getTurbulenceScore(mc, state.islands.stressTest.mcHistory ?? []);
            const uncertainty = turbulence?.uncertainty ?? 0;
            const uncertaintyLabel = getUncertaintyLabel(uncertainty);
            const driftMessage = turbulence?.driftDetected
              ? `<p class="cosmos-drift-alert">Смена режима риска обнаружена · ${formatDateTime(
                  turbulence.driftTs
                )}</p>`
              : '<p class="muted">Смена режима риска не обнаружена.</p>';
            const span = Math.max(1, mc.quantiles.p90 - mc.quantiles.p10);
            const intervalStart = 0;
            const intervalWidth = 100;
            const medianPos = Math.max(0, Math.min(100, ((mc.quantiles.p50 - mc.quantiles.p10) / span) * 100));
            return `<section class="cosmos-forecast-block"><h4>Прогноз Монте-Карло</h4><p>Вероятность провала: <strong>${mc.ruinProb.toFixed(
              1
            )}%</strong> (РИСК от ${(MC_RISK_BADGE_THRESHOLD * 100).toFixed(0)}%)</p><p>Запас хода p10/p50/p90: ${formatMonths(
              mc.quantiles.p10
            )} / ${formatMonths(mc.quantiles.p50)} / ${formatMonths(mc.quantiles.p90)}</p><p>Неопределённость: <strong>${uncertaintyLabel}</strong></p>${driftMessage}<div class="cosmos-interval" role="img" aria-label="Интервал запаса хода p10-p90 и медиана p50"><span class="cosmos-interval-range" style="left:${intervalStart}%;width:${intervalWidth}%"></span><span class="cosmos-interval-median" style="left:${medianPos}%"></span></div></section>`;
          })()
        : '';
    const historyDriftBlock =
      selectedPlanetId === 'history'
        ? (() => {
            const forecast = state.observations.cashflowForecastLast;
            const driftSignal = turbulenceSignalById.get('cashflowDrift');
            const driftBlock = driftSignal
              ? `<p>Режим: <strong>${Boolean(driftSignal.evidence?.driftDetected) ? 'обнаружена смена' : 'без сигнала'}</strong></p><p>Оценка дрейфа: <strong>${(
                  driftSignal.score * 100
                ).toFixed(0)}%</strong>${driftSignal.ym ? ` · месяц ${driftSignal.ym}` : ''}</p>`
              : '<p class="muted">Сигнал режима появится после накопления наблюдений.</p>';
            const forecastBlock = forecast
              ? (() => {
                  const span = Math.max(1, forecast.quantiles.p90 - forecast.quantiles.p10);
                  const medianPos = Math.max(0, Math.min(100, ((forecast.quantiles.p50 - forecast.quantiles.p10) / span) * 100));
                  const disagreement = forecast.disagreementScore ?? 0;
                  const agreement = getDisagreementLabel(disagreement);
                  return `<p>Риск прогноза: <strong>${(forecast.probNetNegative * 100).toFixed(1)}%</strong> (РИСК от ${(FORECAST_RISK_BADGE_THRESHOLD * 100).toFixed(
                    0
                  )}%)</p><p>Согласие моделей: <strong>${agreement}</strong> (${Math.round(disagreement * 100)}%)</p><p class="muted">Почему: сравниваем p50 разных методов (IID/MBB/Trend). Чем больше разброс, тем выше турбулентность halo.</p><p>Чистый поток p10/p50/p90: ${formatNumber(Math.round(forecast.quantiles.p10))} / ${formatNumber(Math.round(
                    forecast.quantiles.p50
                  ))} / ${formatNumber(Math.round(forecast.quantiles.p90))}</p><div class="cosmos-interval" role="img" aria-label="Интервал прогноза чистого потока p10-p90"><span class="cosmos-interval-range" style="left:0%;width:100%"></span><span class="cosmos-interval-median" style="left:${medianPos}%"></span></div>`;
                })()
              : '<p class="muted">Запусти прогноз в Истории (3/6/12 мес).</p>';
            return `<section class="cosmos-forecast-block"><h4>Прогноз истории</h4>${driftBlock}${forecastBlock}</section>`;
          })()
        : '';
    activityPanel.innerHTML = `<h3>Последние действия · ${title}</h3>${list}${mcForecastBlock}${historyDriftBlock}${signalsBlock}`;
  };

  const shouldShowPlanet = (id: IslandId) => !uiFlags.onlyImportant || importantPlanets.has(id);

  const updateSelectionState = () => {
    planetGroups.forEach((group, id) => {
      group.classList.toggle('is-selected', selectedPlanetId === id);
      group.classList.toggle('show-label', uiFlags.showAllLabels || selectedPlanetId === id || importantPlanets.has(id));
      group.classList.toggle('is-hidden', !shouldShowPlanet(id));
    });
    renderActivityPanel();
  };

  const splitLabel = (text: string): [string, string?] => {
    if (text.length <= 14) return [text];
    const words = text.split(' ');
    if (words.length === 1) return [text.slice(0, 14), text.slice(14, 28)];
    const first = [] as string[];
    let i = 0;
    while (i < words.length && `${first.join(' ')} ${words[i]}`.trim().length <= 14) {
      first.push(words[i]);
      i += 1;
    }
    const second = words.slice(i).join(' ');
    return [first.join(' '), second || undefined];
  };

  PLANETS.filter((item) => item.id === 'history' || islandRegistry.some((island) => island.id === item.id)).forEach((planet) => {
    const instrument = statuses.get(planet.id)!;
    const catalogItem = planet.id === 'history' ? null : getIslandCatalogItem(planet.id);
    const radius = ORBIT_RADIUS[planet.orbitId] * planet.distanceFactor;
    const point = toPoint(planet.angleDeg, radius);
    planetPoints.set(planet.id, point);
    const recentEvents = getRecentPlanetEvents(cosmosActivityLog, planet.id, RECENT_ACTION_LIMIT);
    recentEventsByPlanet.set(planet.id, recentEvents);
    const trail = getTrailStats(cosmosActivityLog, planet.id);

    const planetGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    planetGroup.setAttribute('class', 'cosmos-planet');
    planetGroup.setAttribute('data-testid', `cosmos-planet-${planet.id}`);
    if (!uiFlags.reduceMotion) {
      planetGroup.classList.add('cosmos-planet--twinkle');
      planetGroup.style.setProperty('--twinkle-phase', `${(Math.random() * 2.4).toFixed(2)}s`);
    }
    planetGroup.setAttribute('tabindex', shouldShowPlanet(planet.id) ? '0' : '-1');
    planetGroup.setAttribute('role', 'button');
    planetGroup.setAttribute(
      'aria-label',
      `${catalogItem?.displayName ?? "История"}: ${
        instrument.badge === 'risk' ? 'RISK' : instrument.badge === 'ok' ? 'OK' : 'NO DATA'
      }`
    );


    if (trail.count > 0) {
      for (let index = 0; index < trail.count; index += 1) {
        const offset = index + 1;
        const trailPoint = toPoint(planet.angleDeg - offset * 6, radius + offset * 2.5);
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', trailPoint.x.toFixed(1));
        dot.setAttribute('cy', trailPoint.y.toFixed(1));
        dot.setAttribute('r', String(Math.max(1.4, 2.6 - index * 0.2)));
        dot.setAttribute('class', `cosmos-history-dot${uiFlags.reduceMotion ? '' : ' cosmos-history-dot--pulse'}`);
        dot.style.opacity = String(Math.max(0.2, trail.freshness * (1 - index * 0.12)));
        viewport.appendChild(dot);
      }
    }

    const body = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    body.setAttribute('cx', point.x.toFixed(1));
    body.setAttribute('cy', point.y.toFixed(1));
    body.setAttribute('r', '12');
    body.setAttribute('fill', 'url(#planetGradient)');
    planetGroup.appendChild(body);

    const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    halo.setAttribute('cx', point.x.toFixed(1));
    halo.setAttribute('cy', point.y.toFixed(1));
    halo.setAttribute('r', '18');
    halo.setAttribute('class', `cosmos-planet-halo${uiFlags.reduceMotion ? '' : ' cosmos-planet-halo--pulse'}`);
    const fallbackHaloStrength = Math.max(
      instrument.riskSeverity,
      instrument.confidence === null ? 0.5 : 1 - instrument.confidence / 100
    );
    const haloStrength = instrument.turbulence ?? fallbackHaloStrength;
    const baseHaloOpacity = Math.max(0.16, haloStrength);
    halo.style.opacity = uiFlags.showHalo ? String(baseHaloOpacity) : '0';
    halo.style.setProperty('--halo-base-opacity', String(baseHaloOpacity));
    planetGroup.appendChild(halo);

    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hit.setAttribute('cx', point.x.toFixed(1));
    hit.setAttribute('cy', point.y.toFixed(1));
    hit.setAttribute('r', '22');
    hit.setAttribute('class', 'cosmos-planet-hit');
    planetGroup.appendChild(hit);

    const badge = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    badge.setAttribute('cx', (point.x + 12).toFixed(1));
    badge.setAttribute('cy', (point.y - 9).toFixed(1));
    badge.setAttribute('r', '4.5');
    badge.setAttribute('class', `cosmos-badge cosmos-badge--${instrument.badge}`);
    planetGroup.appendChild(badge);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    const labelY = Math.max(20, Math.min(VIEWBOX_SIZE - 28, point.y + 28));
    const labelX = Math.max(16, Math.min(VIEWBOX_SIZE - 16, point.x));
    label.setAttribute('x', labelX.toFixed(1));
    label.setAttribute('y', labelY.toFixed(1));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'cosmos-planet-label');

    const [line1, line2] = splitLabel(catalogItem?.displayName ?? "История");
    const tspan1 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    tspan1.setAttribute('x', labelX.toFixed(1));
    tspan1.textContent = line1;
    label.appendChild(tspan1);
    if (line2) {
      const tspan2 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      tspan2.setAttribute('x', labelX.toFixed(1));
      tspan2.setAttribute('dy', '1.1em');
      tspan2.textContent = line2;
      label.appendChild(tspan2);
    }
    planetGroup.appendChild(label);

    const openPlanetMenu = () => {
      selectedPlanetId = planet.id;
      updateSelectionState();

      const mapRect = map.getBoundingClientRect();
      const wrapRect = mapWrap.getBoundingClientRect();
      const screenX = ((point.x * transform.scale + transform.x) / VIEWBOX_SIZE) * mapRect.width;
      const screenY = ((point.y * transform.scale + transform.y) / VIEWBOX_SIZE) * mapRect.height;
      const labelRect = label.getBoundingClientRect();
      menuState.labelBox = new DOMRect(
        labelRect.left - wrapRect.left,
        labelRect.top - wrapRect.top,
        labelRect.width,
        labelRect.height
      );
      openMenu(planet, screenX + 64, screenY + 8);
    };

    let holdTimer = 0;
    let holdPointerId: number | null = null;
    let holdStartX = 0;
    let holdStartY = 0;
    let holdStarted = false;

    const cancelHold = () => {
      if (holdTimer) {
        window.clearTimeout(holdTimer);
        holdTimer = 0;
      }
      holdPointerId = null;
      holdStarted = false;
    };

    planetGroup.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      if (event.button !== 0) return;
      unlockAudioFromGesture();
      planetGroup.setPointerCapture(event.pointerId);
      holdPointerId = event.pointerId;
      holdStartX = event.clientX;
      holdStartY = event.clientY;
      holdStarted = false;
      holdTimer = window.setTimeout(() => {
        if (holdPointerId !== event.pointerId) return;
        holdStarted = true;
        const wrapRect = mapWrap.getBoundingClientRect();
        openRadialMenu(planet, event.clientX - wrapRect.left, event.clientY - wrapRect.top, event.pointerId);
        radialState.suppressClickFor = planet.id;
      }, HOLD_DELAY_MS);
    });

    planetGroup.addEventListener('pointermove', (event) => {
      event.stopPropagation();
      if (radialState.active?.pointerId === event.pointerId) {
        updateRadialSelection(event.clientX, event.clientY);
        return;
      }
      if (holdPointerId !== event.pointerId || holdStarted) return;
      const distance = Math.hypot(event.clientX - holdStartX, event.clientY - holdStartY);
      if (distance > DEADZONE_RADIUS) {
        cancelHold();
      }
    });

    planetGroup.addEventListener('pointerup', (event) => {
      event.stopPropagation();
      if (radialState.active?.pointerId === event.pointerId) {
        const session = radialState.active;
        const index = session.selectedIndex;
        const action = index >= 0 ? session.actions[index] : null;
        closeRadialMenu();
        if (action) {
          if (action.id === 'close') {
            playSfx('cancel');
          } else {
            playSfx('confirm');
            recordCosmosEvent(session.planet.id, 'confirm', action.id);
            const point = planetPoints.get(session.planet.id);
            if (point) triggerSparkBurst(point.x, point.y);
          }
          runPlanetAction(session.planet.id, action);
        } else {
          playSfx('cancel');
          recordCosmosEvent(session.planet.id, 'cancel', 'radial-idle');
        }
        cancelHold();
        return;
      }
      cancelHold();
    });

    planetGroup.addEventListener('pointercancel', (event) => {
      event.stopPropagation();
      cancelHold();
    });
    planetGroup.addEventListener('pointerleave', (event) => {
      if (!holdStarted && holdPointerId === event.pointerId) {
        cancelHold();
      }
    });

    planetGroup.addEventListener('click', (event) => {
      event.stopPropagation();
      if (radialState.suppressClickFor === planet.id) {
        radialState.suppressClickFor = null;
        return;
      }
      playSfx('select');
      openPlanetMenu();
    });
    planetGroup.addEventListener('pointerenter', () => {
      if (window.matchMedia('(hover: hover)').matches && !importantPlanets.has(planet.id)) {
        planetGroup.classList.add('show-label');
      }
    });
    planetGroup.addEventListener('pointerleave', () => {
      if (!uiFlags.showAllLabels && selectedPlanetId !== planet.id && !importantPlanets.has(planet.id)) {
        planetGroup.classList.remove('show-label');
      }
    });
    planetGroup.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        playSfx('select');
        openPlanetMenu();
      }
    });

    planetGroups.set(planet.id, planetGroup);
    viewport.appendChild(planetGroup);
  });

  updateSelectionState();

  controls.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    if (target.dataset.flag === 'showAllLabels') {
      uiFlags.showAllLabels = target.checked;
      if (target.checked) {
        uiFlags.onlyImportant = false;
        const onlyImportantInput = controls.querySelector<HTMLInputElement>('input[data-flag="onlyImportant"]');
        if (onlyImportantInput) onlyImportantInput.checked = false;
      }
      setCosmosUiFlags({
        cosmosShowAllLabels: uiFlags.showAllLabels,
        cosmosOnlyImportant: uiFlags.onlyImportant
      });
    }
    if (target.dataset.flag === 'onlyImportant') {
      uiFlags.onlyImportant = target.checked;
      if (target.checked) {
        uiFlags.showAllLabels = false;
        const showAllInput = controls.querySelector<HTMLInputElement>('input[data-flag="showAllLabels"]');
        if (showAllInput) showAllInput.checked = false;
      }
      setCosmosUiFlags({
        cosmosOnlyImportant: uiFlags.onlyImportant,
        cosmosShowAllLabels: uiFlags.showAllLabels
      });
      planetGroups.forEach((group, id) => {
        group.setAttribute('tabindex', !uiFlags.onlyImportant || importantPlanets.has(id) ? '0' : '-1');
      });
    }
    if (target.dataset.flag === 'showHalo') {
      uiFlags.showHalo = target.checked;
      setCosmosUiFlags({ cosmosShowHalo: target.checked });
      planetGroups.forEach((group) => {
        const halo = group.querySelector<SVGCircleElement>('.cosmos-planet-halo');
        if (halo) {
          const base = Number(halo.style.getPropertyValue('--halo-base-opacity') || '0.2');
          halo.style.opacity = target.checked ? String(Math.max(0.16, base)) : '0';
        }
      });
    }
    if (target.dataset.flag === 'soundFx') {
      uiFlags.soundFxEnabled = target.checked;
      setCosmosUiFlags({ cosmosSoundFxEnabled: target.checked });
      if (!target.checked) {
        sfx.suspend().catch(() => undefined);
      }
    }
    if (target.dataset.flag === 'sfxГромкость') {
      const volume = Number(target.value);
      uiFlags.sfxГромкость = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : uiFlags.sfxГромкость;
      setCosmosUiFlags({ cosmosSfxГромкость: uiFlags.sfxГромкость });
    }
    if (target.dataset.flag === 'reduceMotion') {
      const override = target.checked ? true : null;
      setCosmosUiFlags({ cosmosReduceMotionOverride: override });
      window.location.reload();
      return;
    }
    updateSelectionState();
  });

  viewSettingsToggle.addEventListener('click', () => {
    const isHidden = viewSettingsPanel.classList.toggle('hidden');
    viewSettingsToggle.setAttribute('aria-expanded', String(!isHidden));
  });

  const activePointers = new Map<number, { clientX: number; clientY: number }>();
  let panPointerId: number | null = null;
  let panStart = { x: 0, y: 0, tx: 0, ty: 0 };
  let pinchStart: { distance: number; transform: ViewTransform; worldX: number; worldY: number } | null = null;
  let lastTap = 0;

  const pointerDistance = () => {
    const points = [...activePointers.values()];
    if (points.length < 2) return 0;
    return Math.hypot(points[0].clientX - points[1].clientX, points[0].clientY - points[1].clientY);
  };

  const pointerMidpointSvg = () => {
    const points = [...activePointers.values()];
    const midX = (points[0].clientX + points[1].clientX) / 2;
    const midY = (points[0].clientY + points[1].clientY) / 2;
    return toSvgPoint(midX, midY);
  };

  map.addEventListener('pointerdown', (event) => {
    if (radialState.active) return;
    unlockAudioFromGesture();
    map.setPointerCapture(event.pointerId);
    activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

    if (activePointers.size === 1) {
      panPointerId = event.pointerId;
      panStart = { x: event.clientX, y: event.clientY, tx: transform.x, ty: transform.y };
    } else if (activePointers.size === 2) {
      const center = pointerMidpointSvg();
      pinchStart = {
        distance: pointerDistance(),
        transform: { ...transform },
        worldX: (center.x - transform.x) / transform.scale,
        worldY: (center.y - transform.y) / transform.scale
      };
      panPointerId = null;
    }
  });

  map.addEventListener('pointermove', (event) => {
    if (radialState.active) return;
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    if (pinchStart && activePointers.size >= 2) {
      const center = pointerMidpointSvg();
      const factor = pointerDistance() / pinchStart.distance;
      const nextScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStart.transform.scale * factor));
      setTransform({
        scale: nextScale,
        x: center.x - pinchStart.worldX * nextScale,
        y: center.y - pinchStart.worldY * nextScale
      });
      return;
    }

    if (panPointerId === event.pointerId) {
      const rect = map.getBoundingClientRect();
      const scaleFactor = rect.width / VIEWBOX_SIZE;
      setTransform({
        ...transform,
        x: panStart.tx + (event.clientX - panStart.x) / scaleFactor,
        y: panStart.ty + (event.clientY - panStart.y) / scaleFactor
      });
    }
  });

  const releasePointer = (event: PointerEvent) => {
    if (radialState.active) return;
    activePointers.delete(event.pointerId);
    if (activePointers.size < 2) pinchStart = null;
    if (panPointerId === event.pointerId) panPointerId = null;

    if (event.pointerType === 'touch') {
      const now = performance.now();
      if (now - lastTap < 280) resetView();
      lastTap = now;
    }
  };

  map.addEventListener('pointerup', releasePointer);
  map.addEventListener('pointercancel', releasePointer);
  map.addEventListener('dblclick', (event) => {
    event.preventDefault();
    resetView();
  });

  map.addEventListener(
    'wheel',
    (event) => {
      if (radialState.active) return;
      event.preventDefault();
      const center = toSvgPoint(event.clientX, event.clientY);
      const zoomFactor = Math.exp(-event.deltaY * 0.0022);
      zoomAroundPoint(center.x, center.y, transform.scale * zoomFactor);
    },
    { passive: false }
  );

  mapWrap.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('.cosmos-radial-menu')) return;
    closeRadialMenu();
    if ((event.target as HTMLElement).closest('.cosmos-menu')) return;
    if ((event.target as SVGElement).closest('.cosmos-planet')) return;
    selectedPlanetId = null;
    updateSelectionState();
    closeMenu();
  });

  const handleVisibilityChange = () => {
    if (document.hidden) {
      clearCometInterval();
      sfx.suspend().catch(() => undefined);
      return;
    }
    startCometInterval();
    if (uiFlags.soundFxEnabled) {
      sfx.resume().catch(() => undefined);
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  const handleBeforeUnload = () => {
    clearCometInterval();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };

  startCometInterval();

  mapWrap.append(resetViewButton, map, menu, radialMenu);
  container.append(header, viewSettingsToggle, viewSettingsPanel, mapWrap);
  window.addEventListener('beforeunload', handleBeforeUnload, { once: true });
  return container;
};
