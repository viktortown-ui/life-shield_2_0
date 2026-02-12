import { islandRegistry } from '../core/registry';
import { getState } from '../core/store';
import {
  buildSparklineSvg,
  formatLastRun,
  getHistoryTail,
  getIslandStatus,
  getReportSummary
} from './reportUtils';

const whyByIsland: Record<string, string> = {
  bayes: 'Понять, хватит ли финансового буфера на ближайшие месяцы.',
  hmm: 'Оценить, стабильная сейчас ситуация или растёт риск стресса.',
  timeseries: 'Увидеть ожидаемый тренд дохода и колебания на горизонте 3 месяцев.',
  optimization: 'Выбрать реалистичный план действий под ваши ограничения.',
  decisionTree: 'Сравнить варианты решения и вероятные последствия.',
  causalDag: 'Разобраться, какие причины сильнее всего влияют на итог.'
};

const inputByIsland: Record<string, string> = {
  bayes: 'Доходы, расходы, резерв и период наблюдений.',
  hmm: 'Последовательность состояний или индикаторов по периодам.',
  timeseries: 'Ряд значений по месяцам/неделям в хронологическом порядке.',
  optimization: 'Доступные опции, бюджет, ограничения и обязательные условия.',
  decisionTree: 'Варианты действий, вероятности исходов и эффект каждого исхода.',
  causalDag: 'Список факторов и связи между ними (что на что влияет).'
};

const outputByIsland: Record<string, string> = {
  bayes: 'Оценку риска, доверительный диапазон и конкретные шаги снижения риска.',
  hmm: 'Текущее состояние, вероятность смены режима и ранние сигналы.',
  timeseries: 'Краткосрочный прогноз с диапазоном и оценкой волатильности.',
  optimization: 'Лучший набор действий с ожидаемой пользой и стоимостью.',
  decisionTree: 'Рейтинг вариантов и ожидаемую ценность каждого решения.',
  causalDag: 'Ключевые рычаги влияния и точки, где менять ситуацию проще всего.'
};

export const createIslandsHubScreen = () => {
  const state = getState();
  const summary = getReportSummary(state);
  const container = document.createElement('div');
  container.className = 'screen islands-hub';

  const header = document.createElement('header');
  header.className = 'screen-header';
  header.innerHTML = `
    <div>
      <h1>Острова</h1>
      <p>Выберите модуль и двигайтесь шаг за шагом.</p>
      <p class="hub-meta">Результатов: ${summary.total} · Ср. индекс: ${summary.avgScore} · Последний запуск: ${formatLastRun(summary.latestRun)}</p>
    </div>
  `;

  const grid = document.createElement('section');
  grid.className = 'shield-grid';

  islandRegistry.forEach((island) => {
    const islandState = state.islands[island.id];
    const status = getIslandStatus(
      islandState.progress.lastRunAt,
      Boolean(islandState.lastReport)
    );
    const trend = getHistoryTail(state, island.id).join(' → ') || '—';

    const card = document.createElement('article');
    card.className = 'shield-tile islands-hub-card';
    card.innerHTML = `
      <span class="tile-status ${status.tone}">${status.label}</span>
      <div class="tile-score">${island.title}</div>
      <div class="tile-headline"><strong>Зачем это:</strong> ${whyByIsland[island.id] ?? island.description}</div>
      <div class="tile-headline"><strong>Что нужно ввести:</strong> ${inputByIsland[island.id] ?? 'Ваши исходные данные по модулю.'}</div>
      <div class="tile-headline"><strong>Что получишь:</strong> ${outputByIsland[island.id] ?? 'Короткий отчёт и следующий шаг.'}</div>
      <div class="tile-progress">
        <span>Запусков: ${islandState.progress.runsCount}</span>
        <span>Последний запуск: ${formatLastRun(islandState.progress.lastRunAt)}</span>
      </div>
      <div class="tile-next">Динамика: ${trend}</div>
      <div class="tile-sparkline">${buildSparklineSvg(islandState.progress.history)}</div>
      <div class="tile-next"><a class="button small" href="#/island/${island.id}">Открыть</a></div>
    `;
    grid.appendChild(card);
  });

  container.append(header, grid);
  return container;
};
