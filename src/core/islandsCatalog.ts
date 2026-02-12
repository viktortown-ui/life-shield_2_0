import { IslandId } from './types';

export type IslandGroup = 'base' | 'lab';

export interface IslandCatalogItem {
  id: IslandId;
  displayName: string;
  shortWhy: string;
  inputHint: string;
  outputHint: string;
  group: IslandGroup;
  badge?: 'База' | 'Лаборатория' | 'Скоро';
}

export const islandsCatalog: Record<IslandId, IslandCatalogItem> = {
  bayes: {
    id: 'bayes',
    displayName: 'Снимок',
    shortWhy: 'Быстро понять, хватает ли текущего запаса прочности.',
    inputHint: 'Доход, расходы, резерв и горизонт в месяцах.',
    outputHint: 'Оценку риска и первый набор действий на ближайший период.',
    group: 'base',
    badge: 'База'
  },
  hmm: {
    id: 'hmm',
    displayName: 'Режимы',
    shortWhy: 'Показать, в каком режиме вы сейчас: стабильно или с риском стресса.',
    inputHint: 'Последовательность сигналов/состояний по периодам.',
    outputHint: 'Текущий режим и вероятность его смены.',
    group: 'base',
    badge: 'База'
  },
  timeseries: {
    id: 'timeseries',
    displayName: 'Тренды',
    shortWhy: 'Увидеть, куда движутся показатели в ближайшие месяцы.',
    inputHint: 'Хронологический ряд значений по неделям или месяцам.',
    outputHint: 'Краткосрочный прогноз, диапазон и волатильность.',
    group: 'base',
    badge: 'База'
  },
  optimization: {
    id: 'optimization',
    displayName: 'Планировщик',
    shortWhy: 'Подобрать лучший набор шагов под ограничения.',
    inputHint: 'Цель, доступные опции и ограничения.',
    outputHint: 'Оптимальный набор действий и ожидаемый эффект.',
    group: 'lab',
    badge: 'Лаборатория'
  },
  decisionTree: {
    id: 'decisionTree',
    displayName: 'Вилки решений',
    shortWhy: 'Сравнить варианты и понять цену каждого выбора.',
    inputHint: 'Сценарии, вероятности исходов и эффекты.',
    outputHint: 'Рейтинг решений и ожидаемая ценность каждого.',
    group: 'lab',
    badge: 'Лаборатория'
  },
  causalDag: {
    id: 'causalDag',
    displayName: 'Причины',
    shortWhy: 'Найти главные факторы, которые двигают результат.',
    inputHint: 'Факторы и связи между ними.',
    outputHint: 'Ключевые рычаги влияния и точки приложения усилий.',
    group: 'lab',
    badge: 'Лаборатория'
  }
};

export const islandCatalogList = Object.values(islandsCatalog);

export const getIslandCatalogItem = (id: IslandId): IslandCatalogItem =>
  islandsCatalog[id];

export const getCatalogByGroup = (group: IslandGroup) =>
  islandCatalogList.filter((item) => item.group === group);

export const baseIslandIds = getCatalogByGroup('base').map((item) => item.id);
