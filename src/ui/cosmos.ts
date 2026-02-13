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

interface ViewTransform {
  x: number;
  y: number;
  scale: number;
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

const ORBIT_LABELS: Record<OrbitId, string> = {
  money: 'Финансы',
  obligations: 'Обязательства',
  income: 'Доход',
  energy: 'Энергия',
  support: 'Поддержка',
  flexibility: 'Гибкость'
};

const VIEWBOX_SIZE = 520;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3.2;
const PAN_MARGIN = 80;

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

  const menu = document.createElement('div');
  menu.className = 'cosmos-menu hidden';

  const closeMenu = () => {
    menu.classList.add('hidden');
    menu.innerHTML = '';
  };

  const menuState = { labelBox: null as DOMRect | null };

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
    const catalogItem = getIslandCatalogItem(config.id);
    menu.classList.remove('hidden');
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
    requestAnimationFrame(() => placeMenu(x, y));
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
  };

  resetViewButton.addEventListener('click', resetView);

  let selectedPlanetId: IslandId | null = null;
  const importantPlanets = new Set(PLANETS.slice(0, 7).map((planet) => planet.id));
  const planetGroups = new Map<IslandId, SVGGElement>();

  const updateSelectionState = () => {
    planetGroups.forEach((group, id) => {
      group.classList.toggle('is-selected', selectedPlanetId === id);
      group.classList.toggle('show-label', selectedPlanetId === id || importantPlanets.has(id));
    });
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

    const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    halo.setAttribute('cx', point.x.toFixed(1));
    halo.setAttribute('cy', point.y.toFixed(1));
    halo.setAttribute('r', '18');
    halo.setAttribute('class', 'cosmos-planet-halo');
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
    badge.setAttribute('class', `cosmos-badge cosmos-badge--${toneToVariant(status.tone)}`);
    planetGroup.appendChild(badge);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    const labelY = Math.max(20, Math.min(VIEWBOX_SIZE - 28, point.y + 28));
    const labelX = Math.max(16, Math.min(VIEWBOX_SIZE - 16, point.x));
    label.setAttribute('x', labelX.toFixed(1));
    label.setAttribute('y', labelY.toFixed(1));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'cosmos-planet-label');

    const [line1, line2] = splitLabel(catalogItem.displayName);
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

    planetGroup.addEventListener('click', openPlanetMenu);
    planetGroup.addEventListener('pointerenter', () => {
      if (window.matchMedia('(hover: hover)').matches && !importantPlanets.has(planet.id)) {
        planetGroup.classList.add('show-label');
      }
    });
    planetGroup.addEventListener('pointerleave', () => {
      if (selectedPlanetId !== planet.id && !importantPlanets.has(planet.id)) {
        planetGroup.classList.remove('show-label');
      }
    });
    planetGroup.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPlanetMenu();
      }
    });

    planetGroups.set(planet.id, planetGroup);
    viewport.appendChild(planetGroup);
  });

  updateSelectionState();

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
      event.preventDefault();
      const center = toSvgPoint(event.clientX, event.clientY);
      const zoomFactor = Math.exp(-event.deltaY * 0.0022);
      zoomAroundPoint(center.x, center.y, transform.scale * zoomFactor);
    },
    { passive: false }
  );

  mapWrap.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('.cosmos-menu')) return;
    if ((event.target as SVGElement).closest('.cosmos-planet')) return;
    selectedPlanetId = null;
    updateSelectionState();
    closeMenu();
  });

  const actions = document.createElement('div');
  actions.className = 'screen-actions';
  actions.innerHTML = `
    <a class="button ghost" href="#/">Домой</a>
    <a class="button ghost" href="#/shield">К щиту</a>
  `;

  mapWrap.append(resetViewButton, map, menu);
  container.append(header, mapWrap, actions);
  return container;
};
