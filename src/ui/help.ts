import { t, getLang } from './i18n';

export type HelpTopicId = 'islandsHub' | 'timeseries' | 'snapshot' | 'stressTest' | 'bayes';

interface HelpTopic {
  id: HelpTopicId;
  title: { ru: string; en: string };
  oneLiner: { ru: string; en: string };
  why: { ru: string; en: string };
  input: { ru: string; en: string };
  output: { ru: string; en: string };
  terms: Array<{ ru: string; en: string }>;
  href?: string;
}

const helpTopics: HelpTopic[] = [
  {
    id: 'islandsHub',
    title: { ru: 'Islands Hub', en: 'Islands Hub' },
    oneLiner: {
      ru: 'Показывает все модули в одном месте и помогает выбрать, с чего начать.',
      en: 'Shows all modules in one place and helps you choose where to start.'
    },
    why: {
      ru: 'Чтобы быстро понять, какие инструменты есть и какой из них решить вашу задачу прямо сейчас.',
      en: 'So you can quickly see available tools and pick the one that solves your current task.'
    },
    input: {
      ru: 'Ничего вводить не нужно. Просто выберите нужный модуль.',
      en: 'No input required. Just choose the module you need.'
    },
    output: {
      ru: 'Переход в нужный модуль и короткая карточка с его смыслом.',
      en: 'Direct access to the selected module and a short card explaining its purpose.'
    },
    terms: [
      {
        ru: 'Модуль — это отдельный мини-инструмент для конкретной задачи.',
        en: 'Module — a separate mini-tool for a specific task.'
      }
    ],
    href: '#/islands'
  },
  {
    id: 'timeseries',
    title: { ru: 'Тренды', en: 'Trends' },
    oneLiner: {
      ru: 'Показывает, как меняются ваши показатели со временем.',
      en: 'Shows how your metrics change over time.'
    },
    why: {
      ru: 'Чтобы заранее заметить ухудшение или рост, а не реагировать в последний момент.',
      en: 'So you can spot decline or growth early, not at the last minute.'
    },
    input: {
      ru: 'Последовательность значений по месяцам или неделям.',
      en: 'A sequence of values by month or week.'
    },
    output: {
      ru: 'Простая картина: куда движется показатель в ближайший период.',
      en: 'A simple view of where a metric is moving in the near term.'
    },
    terms: [
      {
        ru: 'Тренд — общее направление: вверх, вниз или примерно ровно.',
        en: 'Trend — the overall direction: up, down, or mostly flat.'
      }
    ],
    href: '#/island/timeseries'
  },
  {
    id: 'snapshot',
    title: { ru: 'Снимок', en: 'Snapshot' },
    oneLiner: {
      ru: 'Делает быструю проверку вашего текущего финансового состояния.',
      en: 'Runs a quick check of your current financial condition.'
    },
    why: {
      ru: 'Чтобы за пару минут понять, всё в норме или уже есть риск.',
      en: 'So you can understand in minutes whether things are okay or already risky.'
    },
    input: {
      ru: 'Доход, расходы, резерв и платежи по долгам.',
      en: 'Income, expenses, reserve, and debt payments.'
    },
    output: {
      ru: 'Понятная оценка устойчивости и где сейчас самое слабое место.',
      en: 'A clear resilience score and the weakest area right now.'
    },
    terms: [
      {
        ru: 'Запас хода — на сколько месяцев хватит денег без новых поступлений.',
        en: 'Runway — how many months your money lasts without new income.'
      }
    ],
    href: '#/island/snapshot'
  },
  {
    id: 'stressTest',
    title: { ru: 'Стресс-тест', en: 'Stress-test' },
    oneLiner: {
      ru: 'Проверяет, что будет с бюджетом при неприятном сценарии.',
      en: 'Checks what happens to your budget in a bad-case scenario.'
    },
    why: {
      ru: 'Чтобы заранее подготовить план на случай падения дохода или роста расходов.',
      en: 'So you can prepare in advance for income drops or expense spikes.'
    },
    input: {
      ru: 'Те же базовые финданные, плюс параметры сложного сценария.',
      en: 'The same base finance data plus stress-scenario settings.'
    },
    output: {
      ru: 'Где риск высокий и какие шаги стоит сделать в первую очередь.',
      en: 'Where risk is high and which actions to take first.'
    },
    terms: [
      {
        ru: 'Сценарий — возможная ситуация, например «доход снизился на 20%».',
        en: 'Scenario — a possible situation, like “income drops by 20%”.'
      }
    ],
    href: '#/island/stressTest'
  },
  {
    id: 'bayes',
    title: { ru: 'Bayes', en: 'Bayes' },
    oneLiner: {
      ru: 'Оценивает риск с учётом того, что жизнь может пойти по-разному.',
      en: 'Estimates risk while accounting for different possible outcomes.'
    },
    why: {
      ru: 'Чтобы не опираться на один «идеальный» прогноз, а видеть диапазон вариантов.',
      en: 'So you do not rely on a single “perfect” forecast and can see a range of outcomes.'
    },
    input: {
      ru: 'Средние доходы/расходы, запас и горизонт планирования.',
      en: 'Average income/expenses, reserve, and planning horizon.'
    },
    output: {
      ru: 'Оценка вероятности проблем и более реалистичная картина рисков.',
      en: 'A probability-based risk estimate and a more realistic risk picture.'
    },
    terms: [
      {
        ru: 'Вероятность — шанс, что событие действительно случится.',
        en: 'Probability — the chance that an event will actually happen.'
      }
    ],
    href: '#/island/bayes'
  }
];

export const getHelpTopics = () => helpTopics;

const getById = (id: HelpTopicId) =>
  helpTopics.find((topic) => topic.id === id);

const textByLang = (value: { ru: string; en: string }) =>
  value[getLang()];

export const createHelpIconButton = (topicId: HelpTopicId) => {
  const topic = getById(topicId);
  if (!topic) {
    throw new Error(`Unknown help topic: ${topicId}`);
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'help-icon-button';
  button.textContent = '?';
  button.setAttribute('aria-label', `${t('helpLabelPrefix')}: ${textByLang(topic.title)}`);
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
  dialog.setAttribute('aria-label', `${t('helpLabelPrefix')}: ${textByLang(topic.title)}`);

  dialog.innerHTML = `
    <div class="help-modal-header">
      <h2>${textByLang(topic.title)}</h2>
      <button type="button" class="help-close" aria-label="${t('helpClose')}">×</button>
    </div>
    <p class="help-one-liner">${textByLang(topic.oneLiner)}</p>
    <div class="help-sections">
      <section>
        <h3>${t('helpWhy')}</h3>
        <p>${textByLang(topic.why)}</p>
      </section>
      <section>
        <h3>${t('helpInput')}</h3>
        <p>${textByLang(topic.input)}</p>
      </section>
      <section>
        <h3>${t('helpOutput')}</h3>
        <p>${textByLang(topic.output)}</p>
      </section>
      <section>
        <h3>${t('helpTerms')}</h3>
        <ul>
          ${topic.terms.map((item) => `<li>${textByLang(item)}</li>`).join('')}
        </ul>
      </section>
    </div>
  `;

  const close = () => {
    overlay.remove();
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
      window.removeEventListener('keydown', onEsc);
    }
  };
  window.addEventListener('keydown', onEsc);

  overlay.append(dialog);
  return overlay;
};

export const createHelpScreen = () => {
  const container = document.createElement('div');
  container.className = 'screen';

  const topics = getHelpTopics();

  const grid = topics
    .map((topic) => {
      const action = topic.href
        ? `<a class="button small" href="${topic.href}">${t('helpOpenModule')}</a>`
        : '';
      return `
        <article class="shield-tile help-topic-card">
          <div class="help-topic-header">
            <h2>${textByLang(topic.title)}</h2>
          </div>
          <p class="tile-headline">${textByLang(topic.oneLiner)}</p>
          <div class="help-topic-actions" data-help-actions="${topic.id}">
            ${action}
          </div>
        </article>
      `;
    })
    .join('');

  container.innerHTML = `
    <header class="screen-header">
      <h1>${t('navHelp')}</h1>
      <p>${t('helpScreenIntro')}</p>
    </header>
    <section class="shield-grid">${grid}</section>
  `;

  topics.forEach((topic) => {
    const actions = container.querySelector<HTMLElement>(`[data-help-actions="${topic.id}"]`);
    if (!actions) return;
    actions.prepend(createHelpIconButton(topic.id));
  });

  return container;
};
