import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCosmosScreen } from './cosmos';
import { resetState, updateIslandMonteCarlo } from '../core/store';

beforeEach(() => {
  resetState();
  document.body.innerHTML = '';
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
});

describe('cosmos stress panel forecast', () => {
  it('shows monte carlo forecast block when mcLast exists', () => {
    updateIslandMonteCarlo('stressTest', {
      horizonMonths: 24,
      iterations: 5000,
      ruinProb: 34,
      quantiles: { p10: 4, p50: 8, p90: 16 },
      histogram: [],
      config: {
        horizonMonths: 24,
        iterations: 5000,
        incomeVolatility: 0.2,
        expensesVolatility: 0.15,
        seed: 13,
        shock: { enabled: true, probability: 0.1, dropPercent: 0.35 }
      }
    });

    const screen = createCosmosScreen();
    document.body.appendChild(screen);

    const planet = screen.querySelector<SVGGElement>('[data-testid="cosmos-planet-stressTest"]');
    expect(planet).not.toBeNull();
    planet?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const panel = screen.querySelector('.cosmos-activity-panel');
    expect(panel?.textContent).toContain('Прогноз Monte Carlo');
    expect(panel?.textContent).toContain('Вероятность провала');
    expect(panel?.textContent).toContain('Runway p10/p50/p90');
  });
});
