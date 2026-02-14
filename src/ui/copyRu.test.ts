import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forbiddenVisibleRuTerms } from './ruCopyGuard';

class MockWorker {
  addEventListener() {}
  postMessage() {}
  terminate() {}
}

const loadModules = async () => {
  vi.resetModules();
  const { createIslandPage } = await import('./islandPage');
  const { createHistoryScreen } = await import('./history');
  const { updateIslandInput } = await import('../core/store');
  return { createIslandPage, createHistoryScreen, updateIslandInput };
};

describe('RU-first copy with pro terms off', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);
    localStorage.clear();
    localStorage.setItem('ls_lang', 'ru');
    localStorage.setItem('ls_pro_terms', '0');
    document.body.innerHTML = '';
  });

  it('does not render forbidden EN/jargon terms on visible RU screens', async () => {
    const { createIslandPage, createHistoryScreen, updateIslandInput } = await loadModules();

    const financeInput = JSON.stringify({
      monthlyIncome: 200000,
      monthlyExpenses: 120000,
      reserveCash: 500000,
      monthlyDebtPayment: 25000,
      incomeSourcesCount: 3,
      top1Share: 0.7,
      top3Share: 1
    });

    updateIslandInput('snapshot', financeInput);
    updateIslandInput('stressTest', financeInput);
    updateIslandInput('incomePortfolio', financeInput);
    updateIslandInput('timeseries', JSON.stringify({ series: [120, 125, 133], horizon: 3 }));
    updateIslandInput(
      'decisionTree',
      JSON.stringify({
        actions: [{ name: 'A', outcomes: [{ probability: 0.7, payoff: 10, riskTag: 'low' }] }]
      })
    );

    const screens = [
      createIslandPage('snapshot'),
      createIslandPage('stressTest'),
      createIslandPage('incomePortfolio'),
      createIslandPage('timeseries'),
      createIslandPage('decisionTree'),
      createHistoryScreen()
    ];

    document.body.append(...screens);
    expect(document.body.textContent ?? '').not.toMatch(forbiddenVisibleRuTerms);
  });

  it('renders decision tree labels in simple RU', async () => {
    const { createIslandPage } = await loadModules();
    const screen = createIslandPage('decisionTree');
    document.body.append(screen);

    const text = screen.textContent ?? '';
    expect(text).toContain('Ходы');
    expect(text).toContain('Название хода');
    expect(text).toContain('Шанс');
    expect(text).toContain('Награда (баллы)');
    expect(text).toContain('Сумма шансов должна быть 1.0');
  });
});
