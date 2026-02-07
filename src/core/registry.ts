import { IslandId } from './types';
import { getBayesReport } from '../islands/bayes';
import { getHmmReport } from '../islands/hmm';
import { getTimeseriesReport } from '../islands/timeseries';
import { getOptimizationReport } from '../islands/optimization';
import { getDecisionTreeReport } from '../islands/decisionTree';
import { getCausalDagReport } from '../islands/causalDag';

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
    id: 'bayes',
    title: 'Байесовский остров',
    description: 'Гипотезы, вероятности и апостериорные оценки.',
    inputLabel: 'Наблюдения',
    placeholder: 'Опишите исходные предположения...',
    getReport: getBayesReport
  },
  {
    id: 'hmm',
    title: 'Остров скрытых состояний',
    description: 'Markov-подход для динамики состояний.',
    inputLabel: 'Сигналы',
    placeholder: 'Какие события вы наблюдаете?',
    getReport: getHmmReport
  },
  {
    id: 'timeseries',
    title: 'Остров временных рядов',
    description: 'Тренды, сезонность и шум.',
    inputLabel: 'Данные ряда',
    placeholder: 'Опишите тенденции или показатели...',
    getReport: getTimeseriesReport
  },
  {
    id: 'optimization',
    title: 'Остров оптимизации',
    description: 'Поиск лучшего сценария.',
    inputLabel: 'Цель и ограничения',
    placeholder: 'Что нужно максимизировать/минимизировать?',
    getReport: getOptimizationReport
  },
  {
    id: 'decisionTree',
    title: 'Остров решений',
    description: 'Дерево выборов и рисков.',
    inputLabel: 'Варианты решений',
    placeholder: 'Опишите возможные ветки...',
    getReport: getDecisionTreeReport
  },
  {
    id: 'causalDag',
    title: 'Остров причинности',
    description: 'DAG для причинных связей.',
    inputLabel: 'Причины и следствия',
    placeholder: 'Какие факторы влияют на исход?',
    getReport: getCausalDagReport
  }
];

export const findIsland = (id: IslandId) =>
  islandRegistry.find((island) => island.id === id);
