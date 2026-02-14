import { ActionItem, IslandReport } from '../core/types';
import { parseFinanceInput } from './finance';
import { getMetricLabel } from '../i18n/glossary';
import { getLang, getProTerms } from '../ui/i18n';
import { formatNumber, formatPercent } from '../ui/format';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const calculateHhi = (shares: number[]) => shares.reduce((sum, share) => sum + share * share, 0);

export const getIncomePortfolioReport = (input: string): IslandReport => {
  const data = parseFinanceInput(input);

  const topShare = clamp(data.top1Share ?? 0.8, 0, 1);
  const sourceCount = Math.max(1, Math.round(data.incomeSourcesCount || 1));
  const fallbackShares = [topShare, ...Array.from({ length: sourceCount - 1 }, () => (1 - topShare) / Math.max(sourceCount - 1, 1))];

  const sources = data.incomeSources?.length
    ? data.incomeSources
    : fallbackShares.map((share, index) => ({
        name: `Источник ${index + 1}`,
        amount: Math.max(0, data.monthlyIncome * share),
        stability: index === 0 ? 3 : 2
      }));

  const totalIncome = Math.max(
    data.monthlyIncome,
    sources.reduce((sum, source) => sum + Math.max(0, source.amount), 0)
  );

  const shares = sources.map((source) => Math.max(0, source.amount) / Math.max(totalIncome, 1));
  const hhi = calculateHhi(shares);
  const avgStability = average(sources.map((source) => source.stability / 5));

  const hhiScore = clamp(((0.5 - hhi) / 0.45) * 100, 0, 100);
  const topShareScore = clamp(((0.85 - topShare) / 0.75) * 100, 0, 100);
  const stabilityScore = clamp(avgStability * 100, 0, 100);
  const score = Math.round(hhiScore * 0.45 + topShareScore * 0.35 + stabilityScore * 0.2);

  const stateLabel = topShare > 0.75 ? 'Зависишь от одного' : topShare > 0.55 ? 'Нормально' : 'Диверсифицирован';

  const advice: ActionItem[] = [
    {
      title: 'Добавь второй поток дохода',
      impact: 84,
      effort: 58,
      description: 'Сделай источник, который не зависит от основного работодателя.'
    },
    {
      title: 'Подними стабильность источников',
      impact: 68,
      effort: 42,
      description: 'Укрепи регулярные выплаты и убери сезонные провалы.'
    },
    {
      title: 'Уменьши долю главного источника',
      impact: 55,
      effort: 38,
      description: 'Цель — чтобы главный источник давал меньше 60% дохода.'
    }
  ];

  const lang = getLang();
  const proTerms = getProTerms();
  const hhiLabel = getMetricLabel('hhi', { lang, proTerms }).label;
  const topShareLabel = getMetricLabel('topShare', { lang, proTerms }).label;
  const avgStabilityLabel = getMetricLabel('avgStability', { lang, proTerms }).label;

  return {
    id: 'incomePortfolio',
    score,
    confidence: 72,
    headline: stateLabel,
    summary:
      stateLabel === 'Диверсифицирован'
        ? 'Источники распределены, риск просадки ниже.'
        : stateLabel === 'Нормально'
          ? 'Есть опора, но главный источник всё ещё слишком тяжёлый.'
          : 'Один источник тянет почти всё, это уязвимость.',
    details: [
      `${hhiLabel}: ${formatNumber(hhi, { maximumFractionDigits: 2 })}`,
      `${topShareLabel}: ${formatPercent(topShare, 0)}`,
      `${avgStabilityLabel}: ${formatNumber(avgStability, { maximumFractionDigits: 2 })} / 1,00`
    ],
    reasons: [
      `Главный источник даёт ${formatPercent(topShare, 0)} всего дохода.`,
      `Стабильность потоков сейчас на уровне ${formatNumber(avgStability * 100, { maximumFractionDigits: 0 })} из 100.`
    ],
    nextSteps: advice.map((item) => item.title).slice(0, 3),
    actions: advice
  };
};
