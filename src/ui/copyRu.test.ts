import { beforeEach, describe, expect, it, vi } from 'vitest';

const forbidden = /Runway|HHI|Debt burden|Coverage|Burn-in|Step size/;

const loadModules = async () => {
  vi.resetModules();
  const { createIslandPage } = await import('./islandPage');
  const { updateIslandInput } = await import('../core/store');
  return { createIslandPage, updateIslandInput };
};

describe('RU-first copy with pro terms off', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('ls_lang', 'ru');
    localStorage.setItem('ls_pro_terms', '0');
    document.body.innerHTML = '';
  });

  it('does not render forbidden pro english terms on base islands', async () => {
    const { createIslandPage, updateIslandInput } = await loadModules();

    updateIslandInput(
      'snapshot',
      JSON.stringify({
        monthlyIncome: 200000,
        monthlyExpenses: 120000,
        reserveCash: 500000,
        monthlyDebtPayment: 25000,
        incomeSourcesCount: 3
      })
    );
    updateIslandInput(
      'incomePortfolio',
      JSON.stringify({
        monthlyIncome: 200000,
        monthlyExpenses: 120000,
        reserveCash: 500000,
        monthlyDebtPayment: 25000,
        incomeSourcesCount: 3,
        top1Share: 0.7,
        top3Share: 1
      })
    );

    const snapshot = createIslandPage('snapshot');
    const income = createIslandPage('incomePortfolio');
    document.body.append(snapshot, income);

    expect(document.body.textContent ?? '').not.toMatch(forbidden);
  });
});
