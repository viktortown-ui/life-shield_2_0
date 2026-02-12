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
  snapshot: {
    id: 'snapshot',
    displayName: 'Снимок',
    shortWhy: 'Понять финансовую устойчивость на текущий момент по ключевым метрикам.',
    inputHint: 'monthlyIncome, monthlyExpenses, reserveCash, monthlyDebtPayment, incomeSourcesCount.',
    outputHint: 'Runway, долговую нагрузку, покрытие и итоговый индекс 0–100.',
    group: 'base',
    badge: 'База'
  },
  stressTest: {
    id: 'stressTest',
    displayName: 'Стресс-тест',
    shortWhy: 'Проверить, что будет при просадке дохода и росте расходов.',
    inputHint: 'Те же финполя, что и в «Снимке».',
    outputHint: 'Runway по сценариям, зоны риска и короткие подсказки действий.',
    group: 'base',
    badge: 'База'
  },
  incomePortfolio: {
    id: 'incomePortfolio',
    displayName: 'Портфель доходов',
    shortWhy: 'Оценить концентрацию доходов и устойчивость источников.',
    inputHint: 'Список источников (amount, stability) или top1/top3 + число источников.',
    outputHint: 'HHI, долю top-1, стабильность и совет по диверсификации.',
    group: 'base',
    badge: 'База'
  },
  bayes: {
    id: 'bayes',
    displayName: 'Снимок',
    shortWhy: 'Быстро понять, хватает ли текущего запаса прочности.',
    inputHint: 'Доход, расходы, резерв и горизонт в месяцах.',
    outputHint: 'Оценку риска и первый набор действий на ближайший период.',
    group: 'lab',
    badge: 'Лаборатория'
  },
  hmm: {
    id: 'hmm',
    displayName: 'Режимы',
    shortWhy: 'Показать, в каком режиме вы сейчас: стабильно или с риском стресса.',
    inputHint: 'Последовательность сигналов/состояний по периодам.',
    outputHint: 'Текущий режим и вероятность его смены.',
    group: 'lab',
    badge: 'Лаборатория'
  },
  timeseries: {
    id: 'timeseries',
    displayName: 'Тренды',
    shortWhy: 'Увидеть, куда движутся показатели в ближайшие месяцы.',
    inputHint: 'Хронологический ряд значений по неделям или месяцам.',
    outputHint: 'Краткосрочный прогноз, диапазон и волатильность.',
    group: 'lab',
    badge: 'Лаборатория'
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
