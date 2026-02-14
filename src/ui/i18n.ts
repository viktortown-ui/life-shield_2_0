export type Lang = 'ru' | 'en';

const STORAGE_KEY = 'ls_lang';
const CHANGE_EVENT = 'ls:lang-change';

const detectLang = (): Lang => {
  const raw = window.navigator.language.toLowerCase();
  return raw.startsWith('en') ? 'en' : 'ru';
};

export const getLang = (): Lang => {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'ru' || saved === 'en') {
    return saved;
  }
  return detectLang();
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
    cosmosTitle: 'Космос',
    settingsLanguage: 'Язык',
    languageRu: 'Русский',
    languageEn: 'English',
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
    glossaryRunway: 'Runway = Запас хода',
    glossaryConfidence: 'Confidence = Доверие',
    glossaryScore: 'Score = Балл',
    glossaryBurnIn: 'Burn-in = Прогрев',
    glossaryStepSize: 'Step size = Шаг',
    glossarySeasonLength: 'Season length = Сезонность',
    glossaryTestSize: 'Test size = Доля теста',
    glossaryReduceMotion: 'Reduce motion = Меньше анимации',
    helpLabelPrefix: 'Справка',
    helpClose: 'Закрыть справку',
    helpWhy: 'Зачем это',
    helpInput: 'Что нужно ввести',
    helpOutput: 'Что получишь',
    helpTerms: 'Простыми словами',
    helpOpenModule: 'Открыть модуль',
    helpScreenIntro: 'Короткие и понятные пояснения по ключевым модулям.'
  },
  en: {
    navHome: 'Shield',
    navIslands: 'Islands',
    navFinance: 'Finance',
    navHistory: 'History',
    navReport: 'Report',
    navSettings: 'Settings',
    navHelp: 'Help',
    cosmosTitle: 'Cosmos',
    settingsLanguage: 'Language',
    languageRu: 'Русский',
    languageEn: 'English',
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
    glossaryRunway: 'Runway = Runway',
    glossaryConfidence: 'Confidence = Confidence',
    glossaryScore: 'Score = Score',
    glossaryBurnIn: 'Burn-in = Burn-in',
    glossaryStepSize: 'Step size = Step size',
    glossarySeasonLength: 'Season length = Season length',
    glossaryTestSize: 'Test size = Test size',
    glossaryReduceMotion: 'Reduce motion = Reduce motion',
    helpLabelPrefix: 'Help',
    helpClose: 'Close help',
    helpWhy: 'Why use it',
    helpInput: 'What to enter',
    helpOutput: 'What you get',
    helpTerms: 'In simple words',
    helpOpenModule: 'Open module',
    helpScreenIntro: 'Short, plain-language guidance for key modules.'
  }
} as const;

export type I18nKey = keyof (typeof dict)['ru'];

export const t = (key: I18nKey) => dict[getLang()][key];

export const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(getLang(), options).format(value);
