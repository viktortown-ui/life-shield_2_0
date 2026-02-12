import { ActionItem, IslandReport } from '../core/types';
import { parseFinanceInput } from './finance';

const ratio = (a: number, b: number, fallback = 0) => (b > 0 ? a / b : fallback);
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const riskZone = (runwayMonths: number) => {
  if (runwayMonths < 3) return 'красная';
  if (runwayMonths < 6) return 'жёлтая';
  return 'зелёная';
};

export const getStressTestReport = (input: string): IslandReport => {
  const data = parseFinanceInput(input);

  const baseRunway = ratio(data.reserveCash, data.monthlyExpenses, 24);
  const incomeDropRunway = ratio(data.reserveCash, data.monthlyExpenses, 24);
  const incomeDropDebt = ratio(data.monthlyDebtPayment, data.monthlyIncome * 0.7, 1);
  const expensesRiseRunway = ratio(data.reserveCash, data.monthlyExpenses * 1.2, 24);

  const scenarioScore = clamp(
    ((incomeDropRunway + baseRunway + expensesRiseRunway) / 3 / 9) * 100,
    0,
    100
  );

  const hints: ActionItem[] = [];
  if (baseRunway < 6) {
    hints.push({
      title: 'Увеличить денежную подушку',
      impact: 82,
      effort: 48,
      description: 'Приоритет — довести резерв до 6 месяцев расходов.'
    });
  }
  if (incomeDropDebt > 0.35) {
    hints.push({
      title: 'Снизить фиксированный долг',
      impact: 78,
      effort: 55,
      description: 'После просадки дохода платежи становятся критичными.'
    });
  }
  if (data.incomeSourcesCount < 2) {
    hints.push({
      title: 'Добавить 1 дополнительный источник дохода',
      impact: 69,
      effort: 60,
      description: 'Диверсификация сгладит сценарий падения дохода.'
    });
  }

  return {
    id: 'stressTest',
    score: Math.round(scenarioScore),
    confidence: 74,
    headline: `Стресс-тест: база ${baseRunway.toFixed(1)} мес, риск-зона ${riskZone(expensesRiseRunway)}`,
    summary: 'Что будет, если доход просядет или расходы вырастут: оценка запаса прочности по сценариям.',
    details: [
      `Если доход -30%: runway ${incomeDropRunway.toFixed(1)} мес, debt burden ${Math.round(incomeDropDebt * 100)}%`,
      `Если доход без изменений: runway ${baseRunway.toFixed(1)} мес, зона ${riskZone(baseRunway)}`,
      `Если расходы +20%: runway ${expensesRiseRunway.toFixed(1)} мес, зона ${riskZone(expensesRiseRunway)}`
    ],
    actions: hints.slice(0, 3)
  };
};
