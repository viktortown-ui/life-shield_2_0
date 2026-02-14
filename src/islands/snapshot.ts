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

const buildStateLabel = (score: number) => {
  if (score >= 70) return 'Держишься';
  if (score >= 40) return 'Штормит';
  return 'На грани';
};

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
  const stateLabel = buildStateLabel(score);

  const actions: ActionItem[] = [
    {
      title: 'Сократи расход на 5–10%',
      impact: 80,
      effort: 45,
      description: 'Найди 1–2 статьи, которые можно урезать уже в этом месяце.'
    },
    {
      title: `Подними запас до ${Math.max(6, Math.ceil(runwayMonths + 1))} недель`,
      impact: 72,
      effort: 50,
      description: 'Добавь в резерв сумму хотя бы на одну неделю расходов.'
    },
    {
      title: 'Добавь +1 источник дохода',
      impact: 65,
      effort: 58,
      description: 'Даже небольшой второй поток снижает риск просадки.'
    }
  ];

  return {
    id: 'snapshot',
    score,
    confidence: 78,
    headline: stateLabel,
    summary:
      stateLabel === 'Держишься'
        ? 'База крепкая: денег хватает на базовые риски.'
        : stateLabel === 'Штормит'
          ? 'Есть запас, но при просадке станет тесно.'
          : 'Запас слишком тонкий, любое отклонение бьёт по бюджету.',
    details: [
      `${runwayLabel}: ${formatNumber(runwayMonths, { maximumFractionDigits: 1 })} мес`,
      `${debtBurdenLabel}: ${formatPercent(debtBurden, 0)}`,
      `${coverageLabel}: ${formatNumber(coverageRaw, { maximumFractionDigits: 2 })} (источников: ${data.incomeSourcesCount})`
    ],
    reasons: [
      `Запас сейчас около ${formatNumber(runwayMonths, { maximumFractionDigits: 1 })} мес.`,
      `На долги уходит ${formatPercent(debtBurden, 0)} дохода.`
    ],
    nextSteps: actions.map((item) => item.title).slice(0, 3),
    actions
  };
};
