import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModules = async () => {
  vi.resetModules();
  const store = await import('../core/store');
  const financeUi = await import('./finance');
  return { store, financeUi };
};

describe('finance screen', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('saves form values to inputData.finance', async () => {
    const { store, financeUi } = await loadModules();
    const screen = financeUi.createFinanceScreen();
    document.body.appendChild(screen);

    const set = (name: string, value: string) => {
      const input = screen.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      if (!input) throw new Error(`missing input ${name}`);
      input.value = value;
    };

    set('monthlyIncome', '250000');
    set('monthlyExpenses', '140000');
    set('reserveCash', '500000');
    set('monthlyDebtPayment', '30000');
    set('incomeSourcesCount', '3');

    const saveButton = screen.querySelector<HTMLButtonElement>('[data-action="save"]');
    saveButton?.click();

    const state = store.getState();
    expect(state.inputData.finance.monthlyIncome).toBe(250000);
    expect(state.inputData.finance.monthlyExpenses).toBe(140000);
    expect(state.inputData.finance.reserveCash).toBe(500000);
    expect(state.inputData.finance.monthlyDebtPayment).toBe(30000);
    expect(state.inputData.finance.incomeSourcesCount).toBe(3);
  });
});
