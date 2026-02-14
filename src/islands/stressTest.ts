import { ActionItem, IslandReport } from '../core/types';
import { parseFinanceInput } from './finance';
import { getMetricLabel } from '../i18n/glossary';
import { getLang, getProTerms } from '../ui/i18n';
import { formatNumber, formatPercent } from '../ui/format';

const ratio = (a: number, b: number, fallback = 0) => (b > 0 ? a / b : fallback);
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

interface RiskZoneResult {
  zone: 'красная' | 'жёлтая' | 'зелёная';
  why: string;
}

const resolveRiskZone = (
  runwayMonths: number,
  coverage: number,
  debtBurden: number
): RiskZoneResult => {
  const reasons: string[] = [];

  if (runwayMonths < 3) {
    reasons.push(`запас ${formatNumber(runwayMonths, { maximumFractionDigits: 1 })} мес (<3)`);
  } else if (runwayMonths < 6) {
    reasons.push(`запас ${formatNumber(runwayMonths, { maximumFractionDigits: 1 })} мес (<6)`);
  }

  if (coverage < 1) {
    reasons.push(`покрытие ${formatNumber(coverage, { maximumFractionDigits: 2 })} (<1,0)`);
  } else if (coverage < 1.2) {
    reasons.push(`покрытие ${formatNumber(coverage, { maximumFractionDigits: 2 })} (<1,2)`);
  }

  if (debtBurden > 0.45) {
    reasons.push(`долг ${formatPercent(debtBurden, 0)} (>45%)`);
  } else if (debtBurden > 0.3) {
    reasons.push(`долг ${formatPercent(debtBurden, 0)} (>30%)`);
  }

  const hardSignals =
    Number(runwayMonths < 3) + Number(coverage < 1) + Number(debtBurden > 0.45);
  const softSignals =
    Number(runwayMonths < 6) + Number(coverage < 1.2) + Number(debtBurden > 0.3);

  if (hardSignals >= 1 || softSignals >= 3) {
    return {
      zone: 'красная',
      why: reasons.join(', ') || 'метрики ниже безопасного порога'
    };
  }

  if (softSignals >= 1) {
    return {
      zone: 'жёлтая',
      why: reasons.join(', ') || 'часть метрик у границы нормы'
    };
  }

  return {
    zone: 'зелёная',
    why: 'запас, покрытие и долг в безопасных пределах'
  };
};

export const getStressTestReport = (input: string): IslandReport => {
  const data = parseFinanceInput(input);

  const baseRunway = ratio(data.reserveCash, data.monthlyExpenses, 24);
  const coverage = ratio(data.monthlyIncome, data.monthlyExpenses, 0);
  const incomeDropRunway = ratio(data.reserveCash, data.monthlyExpenses, 24);
  const incomeDropDebt = ratio(data.monthlyDebtPayment, data.monthlyIncome * 0.7, 1);
  const expensesRiseRunway = ratio(data.reserveCash, data.monthlyExpenses * 1.2, 24);
  const debtBurden = ratio(data.monthlyDebtPayment, data.monthlyIncome, 1);

  const zoneResult = resolveRiskZone(baseRunway, coverage, debtBurden);

  const scenarioScore = clamp(
    ((incomeDropRunway + baseRunway + expensesRiseRunway) / 3 / 9) * 100,
    0,
    100
  );

  const lang = getLang();
  const proTerms = getProTerms();
  const runwayLabel = getMetricLabel('runway', { lang, proTerms }).label;
  const debtBurdenLabel = getMetricLabel('debtBurden', { lang, proTerms }).label;
  const coverageLabel = getMetricLabel('coverage', { lang, proTerms }).label;

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
    headline: `Стресс-тест: зона ${zoneResult.zone}`,
    summary: `Почему: ${zoneResult.why}. Что будет, если доход просядет или расходы вырастут.`,
    details: [
      `Почему зона: ${zoneResult.why}`,
      `Если доход -30%: ${runwayLabel.toLowerCase()} ${formatNumber(incomeDropRunway, { maximumFractionDigits: 1 })} мес, ${debtBurdenLabel.toLowerCase()} ${formatPercent(incomeDropDebt, 0)}`,
      `Базовый сценарий: ${runwayLabel.toLowerCase()} ${formatNumber(baseRunway, { maximumFractionDigits: 1 })} мес, ${coverageLabel.toLowerCase()} ${formatNumber(coverage, { maximumFractionDigits: 2 })}, ${debtBurdenLabel.toLowerCase()} ${formatPercent(debtBurden, 0)}`,
      `Если расходы +20%: ${runwayLabel.toLowerCase()} ${formatNumber(expensesRiseRunway, { maximumFractionDigits: 1 })} мес`
    ],
    actions: hints.slice(0, 3)
  };
};
