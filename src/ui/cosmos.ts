import { islandRegistry } from '../core/registry';
import { getIslandCatalogItem } from '../core/islandsCatalog';
import { deriveShieldTiles } from '../core/shieldModel';
import { getState } from '../core/store';
import { IslandId } from '../core/types';
import { getIslandStatus } from './reportUtils';

type OrbitId = 'money' | 'obligations' | 'income' | 'energy' | 'support' | 'flexibility';

interface PlanetConfig {
  id: IslandId;
  orbitId: OrbitId;
  angleDeg: number;
  distanceFactor: number;
  dataHref?: string;
}

const PLANETS: PlanetConfig[] = [
  { id: 'snapshot', orbitId: 'money', angleDeg: 20, distanceFactor: 0.8, dataHref: '#/finance' },
  { id: 'stressTest', orbitId: 'obligations', angleDeg: 96, distanceFactor: 0.86, dataHref: '#/finance' },
  { id: 'incomePortfolio', orbitId: 'income', angleDeg: 162, distanceFactor: 0.88, dataHref: '#/finance' },
  { id: 'bayes', orbitId: 'energy', angleDeg: 212, distanceFactor: 0.72 },
  { id: 'hmm', orbitId: 'energy', angleDeg: 254, distanceFactor: 0.9 },
  { id: 'timeseries', orbitId: 'support', angleDeg: 302, distanceFactor: 0.76 },
  { id: 'optimization', orbitId: 'flexibility', angleDeg: 342, distanceFactor: 0.9 },
  { id: 'decisionTree', orbitId: 'support', angleDeg: 42, distanceFactor: 0.94 },
  { id: 'causalDag', orbitId: 'obligations', angleDeg: 136, distanceFactor: 0.68 }
];

const ORBIT_RADIUS: Record<OrbitId, number> = {
  money: 72,
  obligations: 104,
  income: 136,
  energy: 168,
  support: 200,
  flexibility: 232
};

const toneToVariant = (tone: string) => {
  if (tone === 'status--fresh') return 'ok';
  if (tone === 'status--stale') return 'risk';
  return 'none';
};

const toPoint = (angleDeg: number, radius: number) => {
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: 260 + Math.cos(angleRad) * radius,
    y: 260 + Math.sin(angleRad) * radius
  };
};

export const createCosmosScreen = () => {
  const state = getState();
  const tiles = deriveShieldTiles(state);
  const orbitTitleById = new Map(tiles.map((tile) => [tile.id, tile.title]));

  const container = document.createElement('div');
  container.className = 'screen cosmos-screen';

  const header = document.createElement('header');
  header.className = 'screen-header';
  header.innerHTML = `
    <div>
      <h1>Cosmos</h1>
      <p>Альтернативный Home: орбиты доменов и планеты модулей.</p>
    </div>
  `;

  const mapWrap = document.createElement('section');
  mapWrap.className = 'cosmos-map-wrap';

  const map = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  map.setAttribute('viewBox', '0 0 520 520');
  map.setAttribute('class', 'cosmos-map');
  map.setAttribute('role', 'img');
  map.setAttribute('aria-label', 'Карта островов в космосе');

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <radialGradient id="planetGradient" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#7ef7e6" />
      <stop offset="100%" stop-color="#4f8bff" />
    </radialGradient>
  `;
  map.appendChild(defs);

  const sun = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  sun.setAttribute('cx', '260');
  sun.setAttribute('cy', '260');
  sun.setAttribute('r', '20');
  sun.setAttribute('class', 'cosmos-core');
  map.appendChild(sun);

  (Object.keys(ORBIT_RADIUS) as OrbitId[]).forEach((orbitId) => {
    const radius = ORBIT_RADIUS[orbitId];
    const orbit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    orbit.setAttribute('cx', '260');
    orbit.setAttribute('cy', '260');
    orbit.setAttribute('r', String(radius));
    orbit.setAttribute('class', 'cosmos-orbit');
    map.appendChild(orbit);

    const labelPoint = toPoint(orbitId === 'money' ? -90 : -24, radius);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', labelPoint.x.toFixed(1));
    label.setAttribute('y', labelPoint.y.toFixed(1));
    label.setAttribute('class', 'cosmos-orbit-label');
    label.textContent = orbitTitleById.get(orbitId) ?? orbitId;
    map.appendChild(label);
  });

  const menu = document.createElement('div');
  menu.className = 'cosmos-menu hidden';

  const closeMenu = () => {
    menu.classList.add('hidden');
    menu.innerHTML = '';
  };

  const openMenu = (config: PlanetConfig, x: number, y: number) => {
    const catalogItem = getIslandCatalogItem(config.id);
    menu.classList.remove('hidden');
    menu.style.left = `${Math.round(x)}px`;
    menu.style.top = `${Math.round(y)}px`;
    menu.innerHTML = '';

    const title = document.createElement('strong');
    title.textContent = catalogItem.displayName;

    const actions = document.createElement('div');
    actions.className = 'cosmos-menu-actions';
    actions.innerHTML = `
      <a class="button small" href="#/island/${config.id}">Открыть</a>
      ${
        config.dataHref
          ? `<a class="button small ghost" href="${config.dataHref}">Данные</a>`
          : ''
      }
      <button class="button small ghost" type="button" data-close>Закрыть</button>
    `;
    actions.querySelector<HTMLButtonElement>('[data-close]')?.addEventListener('click', () => {
      closeMenu();
    });

    menu.append(title, actions);
  };

  PLANETS.filter((item) => islandRegistry.some((island) => island.id === item.id)).forEach((planet) => {
    const islandState = state.islands[planet.id];
    const status = getIslandStatus(
      islandState.progress.lastRunAt,
      Boolean(islandState.lastReport)
    );
    const catalogItem = getIslandCatalogItem(planet.id);
    const radius = ORBIT_RADIUS[planet.orbitId] * planet.distanceFactor;
    const point = toPoint(planet.angleDeg, radius);

    const planetGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    planetGroup.setAttribute('class', 'cosmos-planet');
    planetGroup.setAttribute('tabindex', '0');
    planetGroup.setAttribute('role', 'button');
    planetGroup.setAttribute('aria-label', `${catalogItem.displayName}: ${status.label}`);

    const body = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    body.setAttribute('cx', point.x.toFixed(1));
    body.setAttribute('cy', point.y.toFixed(1));
    body.setAttribute('r', '12');
    body.setAttribute('fill', 'url(#planetGradient)');
    planetGroup.appendChild(body);

    const badge = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    badge.setAttribute('cx', (point.x + 12).toFixed(1));
    badge.setAttribute('cy', (point.y - 9).toFixed(1));
    badge.setAttribute('r', '4.5');
    badge.setAttribute('class', `cosmos-badge cosmos-badge--${toneToVariant(status.tone)}`);
    planetGroup.appendChild(badge);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', point.x.toFixed(1));
    label.setAttribute('y', (point.y + 28).toFixed(1));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'cosmos-planet-label');
    label.textContent = catalogItem.displayName;
    planetGroup.appendChild(label);

    const openPlanetMenu = () => {
      const rect = mapWrap.getBoundingClientRect();
      openMenu(planet, point.x * (rect.width / 520), point.y * (rect.width / 520));
    };

    planetGroup.addEventListener('click', openPlanetMenu);
    planetGroup.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPlanetMenu();
      }
    });

    map.appendChild(planetGroup);
  });

  mapWrap.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('.cosmos-menu')) return;
    if ((event.target as SVGElement).closest('.cosmos-planet')) return;
    closeMenu();
  });

  const actions = document.createElement('div');
  actions.className = 'screen-actions';
  actions.innerHTML = `
    <a class="button ghost" href="#/">Домой</a>
    <a class="button ghost" href="#/shield">К щиту</a>
  `;

  mapWrap.append(map, menu);
  container.append(header, mapWrap, actions);
  return container;
};
