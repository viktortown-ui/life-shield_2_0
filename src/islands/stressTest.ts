import { ActionItem, IslandReport } from '../core/types';
import { parseFinanceInput } from './finance';
import { getMetricLabel } from '../i18n/glossary';
import { getLang, getProTerms } from '../ui/i18n';
import { formatNumber, formatPercent } from '../ui/format';

const ratio = (a: number, b: number, fallback = 0) => (b > 0 ? a / b : fallback);
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const resolveState = (runwayMonths: number, coverage: number, debtBurden: number) => {
  if (runwayMonths >= 6 && coverage >= 1.2 && debtBurden <= 0.35) {
    return 'Запас выдержит';
  }
  if (runwayMonths >= 3 && coverage >= 1) {
    return 'Выдержит частично';
  }
  return 'Не выдержит';
};

export const getStressTestReport = (input: string): IslandReport => {
  const data = parseFinanceInput(input);

  const baseRunway = ratio(data.reserveCash, data.monthlyExpenses, 24);
  const coverage = ratio(data.monthlyIncome, data.monthlyExpenses, 0);
  const incomeDropRunway = ratio(data.reserveCash, data.monthlyExpenses, 24);
  const incomeDropDebt = ratio(data.monthlyDebtPayment, data.monthlyIncome * 0.7, 1);
  const expensesRiseRunway = ratio(data.reserveCash, data.monthlyExpenses * 1.2, 24);
  const debtBurden = ratio(data.monthlyDebtPayment, data.monthlyIncome, 1);

  const stateLabel = resolveState(baseRunway, coverage, debtBurden);

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

  const hints: ActionItem[] = [
    {
      title: 'Собери запас на 3–6 месяцев',
      impact: 82,
      effort: 48,
      description: 'Сначала перекрой 3 месяца расходов, потом доведи до 6.'
    },
    {
      title: 'Режь фикс-расходы',
      impact: 78,
      effort: 55,
      description: 'Сократи обязательные платежи, которые нельзя быстро отменить.'
    },
    {
      title: 'Проверь подушку и страховку',
      impact: 69,
      effort: 40,
      description: 'Подготовь план на случай просадки дохода и роста расходов.'
    }
  ];

  return {
    id: 'stressTest',
    score: Math.round(scenarioScore),
    confidence: 74,
    headline: stateLabel,
    summary:
      stateLabel === 'Запас выдержит'
        ? 'Даже при стрессе запас в целом держит удар.'
        : stateLabel === 'Выдержит частично'
          ? 'В лёгком стрессе справишься, но сильный удар опасен.'
          : 'При стрессе текущего запаса не хватит надолго.',
    details: [
      `Если доход -30%: ${runwayLabel.toLowerCase()} ${formatNumber(incomeDropRunway, { maximumFractionDigits: 1 })} мес, ${debtBurdenLabel.toLowerCase()} ${formatPercent(incomeDropDebt, 0)}`,
      `База: ${runwayLabel.toLowerCase()} ${formatNumber(baseRunway, { maximumFractionDigits: 1 })} мес, ${coverageLabel.toLowerCase()} ${formatNumber(coverage, { maximumFractionDigits: 2 })}`,
      `Если расходы +20%: ${runwayLabel.toLowerCase()} ${formatNumber(expensesRiseRunway, { maximumFractionDigits: 1 })} мес`
    ],
    reasons: [
      `Если доход упадёт, на долги уйдёт ${formatPercent(incomeDropDebt, 0)} дохода.`,
      `Если расходы вырастут, запас снизится до ${formatNumber(expensesRiseRunway, { maximumFractionDigits: 1 })} мес.`
    ],
    nextSteps: hints.map((item) => item.title).slice(0, 3),
    actions: hints.slice(0, 3)
  };
};
