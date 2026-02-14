import { IslandId } from '../core/types';
import { getLang, t } from './i18n';

export type HelpTopicId =
  | 'islandsHub'
  | 'snapshot'
  | 'stressTest'
  | 'incomePortfolio'
  | 'timeseries'
  | 'bayes'
  | 'hmm'
  | 'optimization'
  | 'decisionTree'
  | 'causalDag';

interface LocaleText {
  ru: string;
  en: string;
}

interface HelpTopic {
  id: HelpTopicId;
  moduleId?: IslandId;
  title: LocaleText;
  oneLiner: LocaleText;
  why: LocaleText;
  input: LocaleText[];
  output: LocaleText[];
  example: LocaleText;
  href: string;
}

const helpTopics: HelpTopic[] = [
  {
    id: 'islandsHub',
    title: { ru: 'Острова', en: 'Islands' },
    oneLiner: {
      ru: 'Главный экран модулей: что уже запускали и куда идти дальше.',
      en: 'Main module hub: what ran recently and where to go next.'
    },
    why: {
      ru: 'Чтобы быстро выбрать нужный инструмент без длинных объяснений на карточках.',
      en: 'So you can quickly choose a tool without long explanations on cards.'
    },
    input: [
      {
        ru: 'Ничего вводить не нужно — просто выберите модуль.',
        en: 'No input required — just pick a module.'
      }
    ],
    output: [
      {
        ru: 'Короткий статус по каждому модулю.',
        en: 'A compact status for each module.'
      },
      {
        ru: 'Переход в модуль в один клик.',
        en: 'One-click access to each module.'
      }
    ],
    example: {
      ru: 'Пример статуса: «есть данные · запусков: 3 · динамика: 58 → 63 → 67».',
      en: 'Example status: “has data · runs: 3 · trend: 58 → 63 → 67”.'
    },
    href: '#/islands'
  },
  {
    id: 'snapshot',
    moduleId: 'snapshot',
    title: { ru: 'Снимок', en: 'Snapshot' },
    oneLiner: { ru: 'Быстрая проверка текущей финансовой устойчивости.', en: 'Quick check of current financial resilience.' },
    why: { ru: 'Помогает понять, всё ли в порядке прямо сейчас.', en: 'Helps assess whether things are okay right now.' },
    input: [
      { ru: 'Доход за месяц', en: 'Monthly income' },
      { ru: 'Расходы за месяц', en: 'Monthly expenses' },
      { ru: 'Резерв и платежи по долгам', en: 'Reserve and debt payments' }
    ],
    output: [
      { ru: 'Индекс устойчивости', en: 'Resilience score' },
      { ru: 'Подсказки по слабым местам', en: 'Hints about weak spots' }
    ],
    example: { ru: 'Доход 120 000, расходы 85 000, резерв 300 000.', en: 'Income 120,000, expenses 85,000, reserve 300,000.' },
    href: '#/island/snapshot'
  },
  {
    id: 'stressTest',
    moduleId: 'stressTest',
    title: { ru: 'Стресс-тест', en: 'Stress test' },
    oneLiner: { ru: 'Проверка бюджета при неприятном сценарии.', en: 'Budget check under a bad-case scenario.' },
    why: { ru: 'Позволяет заранее подготовить план действий.', en: 'Lets you prepare an action plan in advance.' },
    input: [
      { ru: 'Текущий доход и расходы', en: 'Current income and expenses' },
      { ru: 'Параметры ухудшения сценария', en: 'Stress scenario settings' }
    ],
    output: [
      { ru: 'Оценка риска по сценарию', en: 'Scenario risk level' },
      { ru: 'Приоритетные шаги для снижения риска', en: 'Priority actions to reduce risk' }
    ],
    example: { ru: 'Сценарий: доход -20%, расходы +10%.', en: 'Scenario: income -20%, expenses +10%.' },
    href: '#/island/stressTest'
  },
  {
    id: 'incomePortfolio',
    moduleId: 'incomePortfolio',
    title: { ru: 'Портфель доходов', en: 'Income portfolio' },
    oneLiner: { ru: 'Показывает зависимость от отдельных источников дохода.', en: 'Shows dependence on individual income sources.' },
    why: { ru: 'Нужен для снижения риска потери ключевого дохода.', en: 'Useful for lowering single-source income risk.' },
    input: [
      { ru: 'Источники дохода и суммы', en: 'Income sources and amounts' },
      { ru: 'Насколько стабилен каждый источник', en: 'Stability of each source' }
    ],
    output: [
      { ru: 'Оценка концентрации доходов', en: 'Income concentration estimate' },
      { ru: 'Рекомендации по диверсификации', en: 'Diversification recommendations' }
    ],
    example: { ru: '2 источника: 80% и 20% дохода.', en: '2 sources: 80% and 20% of income.' },
    href: '#/island/incomePortfolio'
  },
  {
    id: 'timeseries',
    moduleId: 'timeseries',
    title: { ru: 'Тренды', en: 'Trends' },
    oneLiner: { ru: 'Показывает направление изменений по времени.', en: 'Shows direction of change over time.' },
    why: { ru: 'Позволяет заранее заметить ухудшение или рост.', en: 'Helps spot deterioration or growth early.' },
    input: [
      { ru: 'Ряд значений по неделям или месяцам', en: 'Series by week or month' }
    ],
    output: [
      { ru: 'Краткосрочная динамика', en: 'Short-term dynamics' },
      { ru: 'Ориентир для следующего шага', en: 'Guidance for the next step' }
    ],
    example: { ru: 'Последние значения: 42, 45, 47, 49.', en: 'Recent values: 42, 45, 47, 49.' },
    href: '#/island/timeseries'
  },
  {
    id: 'bayes',
    moduleId: 'bayes',
    title: { ru: 'Вероятности', en: 'Probabilities' },
    oneLiner: { ru: 'Оценка риска с учётом разных возможных исходов.', en: 'Risk estimate accounting for multiple possible outcomes.' },
    why: { ru: 'Помогает не опираться на один сценарий.', en: 'Prevents relying on only one scenario.' },
    input: [
      { ru: 'Доход, расходы, резерв и горизонт', en: 'Income, expenses, reserve, and horizon' }
    ],
    output: [
      { ru: 'Вероятность проблем в выбранном горизонте', en: 'Probability of issues in the selected horizon' }
    ],
    example: { ru: 'Горизонт: 6 месяцев, резерв: 250 000.', en: 'Horizon: 6 months, reserve: 250,000.' },
    href: '#/island/bayes'
  },
  {
    id: 'hmm',
    moduleId: 'hmm',
    title: { ru: 'Режимы', en: 'Regimes' },
    oneLiner: { ru: 'Показывает, в каком состоянии сейчас находится система.', en: 'Shows which regime the system is currently in.' },
    why: { ru: 'Нужен, чтобы понимать, стабилен период или напряжён.', en: 'Helps identify stable versus stressed periods.' },
    input: [{ ru: 'Последовательность наблюдений по периодам', en: 'Sequence of observations by period' }],
    output: [{ ru: 'Текущий режим и риск смены режима', en: 'Current regime and regime-switch risk' }],
    example: { ru: 'Последние 12 точек по месяцам.', en: 'Last 12 monthly points.' },
    href: '#/island/hmm'
  },
  {
    id: 'optimization',
    moduleId: 'optimization',
    title: { ru: 'Планировщик', en: 'Planner' },
    oneLiner: { ru: 'Подбирает наиболее полезный набор действий.', en: 'Selects the most useful action set.' },
    why: { ru: 'Упрощает выбор при ограниченных ресурсах.', en: 'Simplifies choices with limited resources.' },
    input: [{ ru: 'Цели, ограничения и варианты действий', en: 'Goals, constraints, and action options' }],
    output: [{ ru: 'Рекомендованный план действий', en: 'Recommended action plan' }],
    example: { ru: 'Цель: снизить риск при фиксированном бюджете.', en: 'Goal: lower risk under fixed budget.' },
    href: '#/island/optimization'
  },
  {
    id: 'decisionTree',
    moduleId: 'decisionTree',
    title: { ru: 'Вилки решений', en: 'Decision branches' },
    oneLiner: { ru: 'Сравнение вариантов решения по последствиям.', en: 'Compares decision options by consequences.' },
    why: { ru: 'Помогает выбрать вариант с лучшим балансом риска и пользы.', en: 'Helps pick the best risk-benefit balance.' },
    input: [{ ru: 'Варианты, вероятности и эффекты', en: 'Options, probabilities, and effects' }],
    output: [{ ru: 'Рейтинг вариантов', en: 'Option ranking' }],
    example: { ru: 'Сценарии A/B/C с вероятностями исходов.', en: 'A/B/C scenarios with outcome probabilities.' },
    href: '#/island/decisionTree'
  },
  {
    id: 'causalDag',
    moduleId: 'causalDag',
    title: { ru: 'Причины', en: 'Causes' },
    oneLiner: { ru: 'Показывает ключевые связи между факторами.', en: 'Shows key links between factors.' },
    why: { ru: 'Нужен, чтобы воздействовать на причины, а не только симптомы.', en: 'Helps act on causes, not only symptoms.' },
    input: [{ ru: 'Факторы и связи между ними', en: 'Factors and relations between them' }],
    output: [{ ru: 'Главные точки влияния', en: 'Main intervention points' }],
    example: { ru: 'Факторы: доход, расходы, долг, резерв.', en: 'Factors: income, expenses, debt, reserve.' },
    href: '#/island/causalDag'
  }
];

const textByLang = (value: LocaleText) => value[getLang()];

export const getHelpTopics = () => helpTopics;

const getById = (id: HelpTopicId) => helpTopics.find((topic) => topic.id === id);

const createHelpDetails = (topic: HelpTopic) => {
  const details = document.createElement('div');
  details.className = 'help-sections';
  details.innerHTML = `
    <section>
      <h3>${t('helpWhy')}</h3>
      <p>${textByLang(topic.why)}</p>
    </section>
    <section>
      <h3>${t('helpInput')}</h3>
      <ul>${topic.input.map((item) => `<li>${textByLang(item)}</li>`).join('')}</ul>
    </section>
    <section>
      <h3>${t('helpOutput')}</h3>
      <ul>${topic.output.map((item) => `<li>${textByLang(item)}</li>`).join('')}</ul>
    </section>
    <section>
      <h3>${t('helpExample')}</h3>
      <p>${textByLang(topic.example)}</p>
    </section>
  `;
  return details;
};

export const createHelpIconButton = (topicId: HelpTopicId) => {
  const topic = getById(topicId);
  if (!topic) {
    throw new Error(`Unknown help topic: ${topicId}`);
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'help-icon-button';
  button.textContent = '?';
  const descId = `help-topic-desc-${topicId}`;
  button.setAttribute('aria-label', `${t('helpLabelPrefix')}: ${textByLang(topic.title)}`);
  button.setAttribute('aria-describedby', descId);

  const sr = document.createElement('span');
  sr.id = descId;
  sr.className = 'sr-only';
  sr.textContent = textByLang(topic.oneLiner);
  button.appendChild(sr);

  button.addEventListener('click', () => {
    document.body.append(createHelpModal(topicId));
  });

  return button;
};

export const createHelpModal = (topicId: HelpTopicId) => {
  const topic = getById(topicId);
  if (!topic) {
    throw new Error(`Unknown help topic: ${topicId}`);
  }

  const overlay = document.createElement('div');
  overlay.className = 'help-modal-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'help-modal';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.id = `help-dialog-${topicId}`;
  dialog.setAttribute('aria-label', `${t('helpLabelPrefix')}: ${textByLang(topic.title)}`);

  dialog.innerHTML = `
    <div class="help-modal-header">
      <h2>${textByLang(topic.title)}</h2>
      <button type="button" class="help-close" aria-label="${t('helpClose')}">×</button>
    </div>
    <p class="help-one-liner">${textByLang(topic.oneLiner)}</p>
  `;
  dialog.append(createHelpDetails(topic));

  const action = document.createElement('div');
  action.className = 'help-topic-actions';
  action.innerHTML = `<a class="button small" href="${topic.href}">${t('helpOpenModule')}</a>`;
  dialog.append(action);

  const close = () => {
    overlay.remove();
    window.removeEventListener('keydown', onEsc);
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      close();
    }
  });
  dialog.querySelector('.help-close')?.addEventListener('click', close);

  const onEsc = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      close();
    }
  };
  window.addEventListener('keydown', onEsc);

  overlay.append(dialog);
  return overlay;
};

export const createHelpScreen = () => {
  const container = document.createElement('div');
  container.className = 'screen';

  const topics = getHelpTopics().filter((topic) => topic.id !== 'islandsHub');

  container.innerHTML = `
    <header class="screen-header">
      <h1>${t('navHelp')}</h1>
      <p>${t('helpScreenIntro')}</p>
      <input class="help-search-input" data-help-search type="search" placeholder="${t('helpSearchPlaceholder')}" aria-label="${t('helpSearchPlaceholder')}" />
    </header>
    <section class="shield-grid" data-help-list></section>
    <p class="muted hidden" data-help-empty>${t('helpNoResults')}</p>
  `;

  const list = container.querySelector<HTMLElement>('[data-help-list]');
  const empty = container.querySelector<HTMLElement>('[data-help-empty]');
  const search = container.querySelector<HTMLInputElement>('[data-help-search]');

  const render = (query: string) => {
    if (!list || !empty) return;
    const q = query.trim().toLocaleLowerCase(getLang());
    const filtered = topics.filter((topic) => {
      const haystack = [
        textByLang(topic.title),
        textByLang(topic.oneLiner),
        textByLang(topic.why),
        ...topic.input.map((item) => textByLang(item)),
        ...topic.output.map((item) => textByLang(item))
      ].join(' ').toLocaleLowerCase(getLang());
      return q.length === 0 || haystack.includes(q);
    });

    list.innerHTML = '';
    filtered.forEach((topic) => {
      const card = document.createElement('article');
      card.className = 'shield-tile help-topic-card';
      card.innerHTML = `
        <details>
          <summary class="help-topic-header">
            <h2>${textByLang(topic.title)}</h2>
            <span class="tile-status tile-status--chip status--neutral">${textByLang(topic.oneLiner)}</span>
          </summary>
        </details>
      `;
      const details = card.querySelector('details');
      details?.append(createHelpDetails(topic));

      const actions = document.createElement('div');
      actions.className = 'help-topic-actions';
      actions.innerHTML = `<a class="button small" href="${topic.href}">${t('helpOpenModule')}</a>`;
      details?.append(actions);
      list.append(card);
    });

    empty.classList.toggle('hidden', filtered.length > 0);
  };

  search?.addEventListener('input', () => render(search.value));
  render('');

  return container;
};
