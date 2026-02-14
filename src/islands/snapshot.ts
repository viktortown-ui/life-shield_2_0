import { ActionItem, IslandReport } from '../core/types';
import { parseFinanceInput } from './finance';
import { getMetricLabel } from '../i18n/glossary';
import { getLang, getProTerms } from '../ui/i18n';
import { formatNumber, formatPercent } from '../ui/format';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const ratio = (a: number, b: number, fallback = 0) =>
  b > 0 ? a / b : fallback;

const normalize = (value: number, scale: number) =>
  clamp((value / scale) * 100, 0, 100);

export const getSnapshotReport = (input: string): IslandReport => {
  const data = parseFinanceInput(input);
  const runwayMonths = ratio(data.reserveCash, data.monthlyExpenses, 24);
  const debtBurden = ratio(data.monthlyDebtPayment, data.monthlyIncome, 1);
  const coverageRaw =
    ratio(data.monthlyIncome, data.monthlyExpenses, 0) +
    clamp((data.incomeSourcesCount - 1) * 0.05, 0, 0.3);

  const runwayScore = normalize(runwayMonths, 12);
  const debtScore = clamp((1 - debtBurden / 0.6) * 100, 0, 100);
  const coverageScore = normalize(coverageRaw, 2);
  const score = Math.round(runwayScore * 0.4 + debtScore * 0.3 + coverageScore * 0.3);

  const lang = getLang();
  const proTerms = getProTerms();
  const runwayLabel = getMetricLabel('runway', { lang, proTerms }).label;
  const debtBurdenLabel = getMetricLabel('debtBurden', { lang, proTerms }).label;
  const coverageLabel = getMetricLabel('coverage', { lang, proTerms }).label;

  const actions: ActionItem[] = [
    {
      title: 'Поднять запас до 6+ месяцев',
      impact: 80,
      effort: 45,
      description: 'Добавьте в резерв не менее одного месячного расхода.'
    },
    {
      title: 'Снизить долговую нагрузку',
      impact: 72,
      effort: 50,
      description: 'Рефинансируйте или досрочно закройте самый дорогой долг.'
    }
  ];

  return {
    id: 'snapshot',
    score,
    confidence: 78,
    headline: `Снимок: запас ${formatNumber(runwayMonths, { maximumFractionDigits: 1 })} мес, долг ${formatPercent(debtBurden, 0)} дохода`,
    summary: 'Текущий финансовый профиль показывает устойчивость, долговую нагрузку и покрытие расходов.',
    details: [
      `${runwayLabel}: ${formatNumber(runwayMonths, { maximumFractionDigits: 1 })} мес`,
      `${debtBurdenLabel}: ${formatPercent(debtBurden, 0)}`,
      `${coverageLabel}: ${formatNumber(coverageRaw, { maximumFractionDigits: 2 })} (с учётом источников: ${data.incomeSourcesCount})`
    ],
    actions
  };
};
