import { ActionItem, IslandReport } from '../core/types';
import { parseFinanceInput } from './finance';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export const getIncomePortfolioReport = (input: string): IslandReport => {
  const data = parseFinanceInput(input);
  const sources = data.incomeSources?.length
    ? data.incomeSources
    : [
        {
          amount: data.monthlyIncome * (data.top1Share ?? 0.8),
          stability: 3
        },
        {
          amount: data.monthlyIncome * Math.max(0, (data.top3Share ?? 1) - (data.top1Share ?? 0.8)),
          stability: 3
        },
        {
          amount: data.monthlyIncome * Math.max(0, 1 - (data.top3Share ?? 1)),
          stability: 3
        }
      ].filter((item) => item.amount > 0);

  const total = Math.max(1, sources.reduce((sum, source) => sum + source.amount, 0));
  const shares = sources.map((source) => source.amount / total).sort((a, b) => b - a);
  const topShare = shares[0] ?? 1;
  const hhi = shares.reduce((sum, share) => sum + share * share, 0);
  const avgStability = average(sources.map((source) => source.stability / 5));

  const hhiScore = clamp(((0.5 - hhi) / 0.45) * 100, 0, 100);
  const topShareScore = clamp(((0.85 - topShare) / 0.75) * 100, 0, 100);
  const stabilityScore = clamp(avgStability * 100, 0, 100);
  const score = Math.round(hhiScore * 0.45 + topShareScore * 0.35 + stabilityScore * 0.2);

  const concentration = hhi > 0.4 || topShare > 0.7 ? 'высокая' : hhi > 0.25 ? 'средняя' : 'низкая';

  const advice: ActionItem =
    concentration === 'высокая'
      ? {
          title: 'Снизить концентрацию top-1 дохода',
          impact: 84,
          effort: 58,
          description: 'Доведите долю крупнейшего источника ниже 60%.'
        }
      : concentration === 'средняя'
        ? {
            title: 'Укрепить 2-й и 3-й источники',
            impact: 68,
            effort: 42,
            description: 'Добавьте стабильные повторяемые поступления.'
          }
        : {
            title: 'Поддерживать диверсификацию',
            impact: 55,
            effort: 20,
            description: 'Раз в месяц проверяйте доли и стабильность источников.'
          };

  return {
    id: 'incomePortfolio',
    score,
    confidence: 72,
    headline: `Портфель доходов: концентрация ${concentration}`,
    summary: 'Оценка концентрации дохода через HHI, долю top-1 и среднюю стабильность источников.',
    details: [
      `HHI: ${hhi.toFixed(2)}`,
      `Top share: ${Math.round(topShare * 100)}%`,
      `Avg stability: ${avgStability.toFixed(2)} / 1.00`
    ],
    actions: [advice]
  };
};
