export type Lang = 'ru' | 'en';

const STORAGE_KEY = 'ls_lang';
const CHANGE_EVENT = 'ls:lang-change';

export const getLang = (): Lang => {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'ru' || saved === 'en') {
    return saved;
  }
  return 'ru';
};

export const setLang = (lang: Lang) => {
  window.localStorage.setItem(STORAGE_KEY, lang);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: lang }));
};

export const onLangChange = (listener: (lang: Lang) => void) => {
  const handler = () => listener(getLang());
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
};

const dict = {
  ru: {
    navHome: 'Щит',
    navIslands: 'Острова',
    navFinance: 'Финансы',
    navHistory: 'История',
    navReport: 'Отчёт',
    navSettings: 'Настройки',
    navHelp: 'Справка',
    bottomNav: 'Нижняя навигация',
    buildLabel: 'Сборка',
    cosmosTitle: 'Космос',
    settingsLanguage: 'Язык',
    languageRu: 'RU',
    languageEn: 'EN',
    stop: 'Стоп',
    start: 'Запустить',
    save: 'Сохранить',
    confidence: 'Доверие',
    score: 'Балл',
    runway: 'Запас хода',
    burnIn: 'Прогрев',
    stepSize: 'Шаг',
    seasonLength: 'Сезонность',
    testSize: 'Доля теста',
    reduceMotion: 'Меньше анимации',
    glossaryTitle: 'Глоссарий терминов',
    glossaryRunway: 'Запас хода',
    glossaryConfidence: 'Доверие',
    glossaryScore: 'Балл',
    glossaryBurnIn: 'Прогрев',
    glossaryStepSize: 'Шаг',
    glossarySeasonLength: 'Сезонность',
    glossaryTestSize: 'Доля теста',
    glossaryReduceMotion: 'Меньше анимации',
    helpLabelPrefix: 'Справка',
    helpClose: 'Закрыть справку',
    helpWhy: 'Зачем это',
    helpInput: 'Что нужно ввести',
    helpOutput: 'Что получишь',
    helpTerms: 'Простыми словами',
    helpOpenModule: 'Открыть модуль',
    helpScreenIntro: 'Короткие и понятные пояснения по ключевым модулям.',
    viewSettings: 'Настройки вида',
    soundFx: 'Звуковые эффекты',
    volume: 'Громкость',
    autoMode: 'Авто',
    horizon: 'Горизонт',
    settingsTitle: 'Настройки',
    settingsSubtitle: 'Экспорт, импорт и обслуживание приложения.'
  },
  en: {
    navHome: 'Shield',
    navIslands: 'Islands',
    navFinance: 'Finance',
    navHistory: 'History',
    navReport: 'Report',
    navSettings: 'Settings',
    navHelp: 'Help',
    bottomNav: 'Bottom navigation',
    buildLabel: 'Build',
    cosmosTitle: 'Cosmos',
    settingsLanguage: 'Language',
    languageRu: 'RU',
    languageEn: 'EN',
    stop: 'Stop',
    start: 'Start',
    save: 'Save',
    confidence: 'Confidence',
    score: 'Score',
    runway: 'Runway',
    burnIn: 'Burn-in',
    stepSize: 'Step size',
    seasonLength: 'Season length',
    testSize: 'Test size',
    reduceMotion: 'Reduce motion',
    glossaryTitle: 'Term glossary',
    glossaryRunway: 'Runway',
    glossaryConfidence: 'Confidence',
    glossaryScore: 'Score',
    glossaryBurnIn: 'Burn-in',
    glossaryStepSize: 'Step size',
    glossarySeasonLength: 'Season length',
    glossaryTestSize: 'Test size',
    glossaryReduceMotion: 'Reduce motion',
    helpLabelPrefix: 'Help',
    helpClose: 'Close help',
    helpWhy: 'Why use it',
    helpInput: 'What to enter',
    helpOutput: 'What you get',
    helpTerms: 'In simple words',
    helpOpenModule: 'Open module',
    helpScreenIntro: 'Short, plain-language guidance for key modules.',
    viewSettings: 'View settings',
    soundFx: 'Sound FX',
    volume: 'Volume',
    autoMode: 'Auto',
    horizon: 'Horizon',
    settingsTitle: 'Settings',
    settingsSubtitle: 'Export, import, and app maintenance.'
  }
} as const;

export type I18nKey = keyof (typeof dict)['ru'];

export const t = (key: I18nKey) => dict[getLang()][key];

export const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(getLang(), options).format(value);

export const formatPercent = (value: number, digits = 0) =>
  new Intl.NumberFormat(getLang(), {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);

export const formatDateTime = (
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions
) =>
  new Intl.DateTimeFormat(getLang(), options ?? { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value)
  );
