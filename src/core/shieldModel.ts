import { AppState } from './types';

export interface ShieldTile {
  id: 'money' | 'obligations' | 'income' | 'energy' | 'support' | 'flexibility';
  title: string;
  score: number;
  source: string;
  summary: string;
}

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, Math.round(value)));

const readPercentFromText = (value: string | undefined): number | null => {
  if (!value) return null;
  const match = value.match(/(\d+)\s*%/);
  if (!match) return null;
  return Number(match[1]) / 100;
};

const classifyConcentration = (headline: string | undefined) => {
  if (!headline) return 'средняя';
  if (headline.includes('высокая')) return 'высокая';
  if (headline.includes('низкая')) return 'низкая';
  return 'средняя';
};

export const deriveShieldTiles = (state: AppState): ShieldTile[] => {
  const snapshot = state.islands.snapshot.lastReport;
  const stressTest = state.islands.stressTest.lastReport;
  const incomePortfolio = state.islands.incomePortfolio.lastReport;
  const finance = state.inputData.finance;

  const runwayMonths = finance.monthlyExpenses > 0 ? finance.reserveCash / finance.monthlyExpenses : 24;
  const coverage = finance.monthlyExpenses > 0 ? finance.monthlyIncome / finance.monthlyExpenses : 1;
  const debtBurden = finance.monthlyIncome > 0 ? finance.monthlyDebtPayment / finance.monthlyIncome : 1;

  const topShare =
    readPercentFromText(incomePortfolio?.details.find((line) => line.includes('Top share'))) ??
    finance.top1Share ??
    1;
  const concentrationClass = classifyConcentration(incomePortfolio?.headline);

  const concentrationPenalty =
    concentrationClass === 'высокая' ? 22 : concentrationClass === 'средняя' ? 10 : 0;

  const moneyScore = clamp(coverage * 35 + runwayMonths * 10);
  const obligationsScore = clamp((1 - debtBurden / 0.6) * 100);
  const incomeScore = clamp((coverage * 36 + (1 - topShare) * 64) - concentrationPenalty);

  const baseScore = Math.round(
    [snapshot?.score ?? moneyScore, stressTest?.score ?? obligationsScore, incomePortfolio?.score ?? incomeScore]
      .reduce((sum, value) => sum + value, 0) / 3
  );

  return [
    {
      id: 'money',
      title: 'Money',
      score: moneyScore,
      source: 'на основе Снимка',
      summary: `Покрытие ${coverage.toFixed(2)} и запас ${runwayMonths.toFixed(1)} мес.`
    },
    {
      id: 'obligations',
      title: 'Obligations',
      score: obligationsScore,
      source: 'на основе Снимка/Стресс-теста',
      summary: `Долговая нагрузка ${Math.round(debtBurden * 100)}% дохода.`
    },
    {
      id: 'income',
      title: 'Income',
      score: incomeScore,
      source: 'на основе Снимка/Портфеля',
      summary: `Top-1 ${Math.round(topShare * 100)}%, концентрация ${concentrationClass}.`
    },
    {
      id: 'energy',
      title: 'Energy',
      score: clamp(baseScore - 4),
      source: 'self-report (временно)',
      summary: 'Оценка личного ресурса до следующего обновления опросника.'
    },
    {
      id: 'support',
      title: 'Support',
      score: clamp(baseScore + 1),
      source: 'self-report (временно)',
      summary: 'Опора на окружение и процессы (временная прокси-оценка).'
    },
    {
      id: 'flexibility',
      title: 'Flexibility',
      score: clamp(baseScore),
      source: 'self-report (временно)',
      summary: 'Способность быстро менять сценарий (временная прокси-оценка).'
    }
  ];
};
