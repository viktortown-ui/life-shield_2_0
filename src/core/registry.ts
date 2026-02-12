import { IslandId } from './types';
import { getSnapshotReport } from '../islands/snapshot';
import { getStressTestReport } from '../islands/stressTest';
import { getIncomePortfolioReport } from '../islands/incomePortfolio';
import { getBayesReport } from '../islands/bayes';
import { getHmmReport } from '../islands/hmm';
import { getTimeseriesReport } from '../islands/timeseries';
import { getOptimizationReport } from '../islands/optimization';
import { getDecisionTreeReport } from '../islands/decisionTree';
import { getCausalDagReport } from '../islands/causalDag';
import { getIslandCatalogItem } from './islandsCatalog';

export interface IslandDefinition {
  id: IslandId;
  title: string;
  description: string;
  inputLabel: string;
  placeholder: string;
  getReport: (input: string) => ReturnType<typeof getBayesReport>;
}

export const islandRegistry: IslandDefinition[] = [
  {
    id: 'snapshot',
    title: getIslandCatalogItem('snapshot').displayName,
    description: getIslandCatalogItem('snapshot').shortWhy,
    inputLabel: 'Финансовые данные (JSON или строки key:value)',
    placeholder: 'monthlyIncome: 210000\nmonthlyExpenses: 130000\nreserveCash: 420000',
    getReport: getSnapshotReport
  },
  {
    id: 'stressTest',
    title: getIslandCatalogItem('stressTest').displayName,
    description: getIslandCatalogItem('stressTest').shortWhy,
    inputLabel: 'Те же финансовые данные',
    placeholder: 'monthlyIncome: 210000\nmonthlyExpenses: 130000\nreserveCash: 420000',
    getReport: getStressTestReport
  },
  {
    id: 'incomePortfolio',
    title: getIslandCatalogItem('incomePortfolio').displayName,
    description: getIslandCatalogItem('incomePortfolio').shortWhy,
    inputLabel: 'Доли/источники доходов',
    placeholder:
      '{"monthlyIncome":210000,"incomeSourcesCount":3,"top1Share":0.55,"top3Share":0.92}',
    getReport: getIncomePortfolioReport
  },
  {
    id: 'bayes',
    title: getIslandCatalogItem('bayes').displayName,
    description: getIslandCatalogItem('bayes').shortWhy,
    inputLabel: 'Наблюдения',
    placeholder: 'Опишите исходные предположения...',
    getReport: getBayesReport
  },
  {
    id: 'hmm',
    title: getIslandCatalogItem('hmm').displayName,
    description: getIslandCatalogItem('hmm').shortWhy,
    inputLabel: 'Сигналы',
    placeholder: 'Какие события вы наблюдаете?',
    getReport: getHmmReport
  },
  {
    id: 'timeseries',
    title: getIslandCatalogItem('timeseries').displayName,
    description: getIslandCatalogItem('timeseries').shortWhy,
    inputLabel: 'Данные ряда',
    placeholder: 'Опишите тенденции или показатели...',
    getReport: getTimeseriesReport
  },
  {
    id: 'optimization',
    title: getIslandCatalogItem('optimization').displayName,
    description: getIslandCatalogItem('optimization').shortWhy,
    inputLabel: 'Цель и ограничения',
    placeholder: 'Что нужно максимизировать/минимизировать?',
    getReport: getOptimizationReport
  },
  {
    id: 'decisionTree',
    title: getIslandCatalogItem('decisionTree').displayName,
    description: getIslandCatalogItem('decisionTree').shortWhy,
    inputLabel: 'Варианты решений',
    placeholder: 'Опишите возможные ветки...',
    getReport: getDecisionTreeReport
  },
  {
    id: 'causalDag',
    title: getIslandCatalogItem('causalDag').displayName,
    description: getIslandCatalogItem('causalDag').shortWhy,
    inputLabel: 'Причины и следствия',
    placeholder: 'Какие факторы влияют на исход?',
    getReport: getCausalDagReport
  }
];

export const findIsland = (id: IslandId) =>
  islandRegistry.find((island) => island.id === id);
