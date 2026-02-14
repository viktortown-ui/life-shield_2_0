import { beforeEach, describe, expect, it, vi } from 'vitest';

const forbidden = /Runway|HHI|EV|EL|Debt burden|Coverage|Burn-in|Step size|Actions?|Probability|Payoff|Risk tag|\bNet\b|Data freshness/i;



class MockWorker {
  addEventListener() {}
  postMessage() {}
  terminate() {}
}

const loadModules = async () => {
  vi.resetModules();
  const { createIslandPage } = await import('./islandPage');
  const { updateIslandInput } = await import('../core/store');
  return { createIslandPage, updateIslandInput };
};

describe('RU-first copy with pro terms off', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);
    localStorage.clear();
    localStorage.setItem('ls_lang', 'ru');
    localStorage.setItem('ls_pro_terms', '0');
    document.body.innerHTML = '';
  });

  it('does not render forbidden pro english terms on visible RU screens when pro terms are off', async () => {
    const { createIslandPage, updateIslandInput } = await loadModules();

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

    const screens = [
      createIslandPage('snapshot'),
      createIslandPage('stressTest'),
      createIslandPage('incomePortfolio'),
      createIslandPage('timeseries')
    ];

    document.body.append(...screens);
    expect(document.body.textContent ?? '').not.toMatch(forbidden);
  });
});
