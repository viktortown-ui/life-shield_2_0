export type Lang = 'ru' | 'en';

const STORAGE_KEY = 'ls_lang';
const PRO_TERMS_STORAGE_KEY = 'ls_pro_terms';
const CHANGE_EVENT = 'ls:lang-change';
const PRO_TERMS_CHANGE_EVENT = 'ls:pro-terms-change';

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

export const getProTerms = (): boolean =>
  window.localStorage.getItem(PRO_TERMS_STORAGE_KEY) === '1';

export const setProTerms = (enabled: boolean) => {
  window.localStorage.setItem(PRO_TERMS_STORAGE_KEY, enabled ? '1' : '0');
  window.dispatchEvent(new CustomEvent(PRO_TERMS_CHANGE_EVENT, { detail: enabled }));
};

export const onProTermsChange = (listener: (enabled: boolean) => void) => {
  const handler = () => listener(getProTerms());
  window.addEventListener(PRO_TERMS_CHANGE_EVENT, handler);
  return () => window.removeEventListener(PRO_TERMS_CHANGE_EVENT, handler);
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
    settingsProTerms: 'Профессиональные термины',
    settingsProTermsHint: 'Показывать проф. аббревиатуры рядом с простыми названиями.',
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
    helpWhatIs: 'Что это',
    helpInput: 'Что вводить',
    helpOutput: 'Как читать результат',
    helpNext: 'Что делать дальше',
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
    ,helpSearchPlaceholder: 'Поиск по модулям'
    ,helpNoResults: 'Ничего не найдено. Попробуйте другое слово.'
    ,helpExample: 'Пример данных'
    ,helpOpenSettings: 'Параметры'
    ,islandsHubIntro: 'Выберите модуль и начните с короткого шага.'
    ,islandsHubSummary: 'Результатов: {total} · Ср. индекс: {avg} · Последний запуск: {latest}'
    ,islandsHubShowLab: 'Показать лабораторию'
    ,islandsHubRuns: 'Запусков: {count}'
    ,islandsHubTrend: 'Динамика: {trend}'
    ,cosmosIntro: 'Карта приоритетов по рискам и свежести данных.'
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
    settingsProTerms: 'Professional terms',
    settingsProTermsHint: 'Show pro abbreviations next to plain labels.',
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
    helpWhatIs: 'What it is',
    helpInput: 'What to enter',
    helpOutput: 'How to read results',
    helpNext: 'What to do next',
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
    ,helpSearchPlaceholder: 'Search modules'
    ,helpNoResults: 'No matches found. Try another query.'
    ,helpExample: 'Example data'
    ,helpOpenSettings: 'Settings'
    ,islandsHubIntro: 'Pick a module and start with one short step.'
    ,islandsHubSummary: 'Reports: {total} · Avg score: {avg} · Last run: {latest}'
    ,islandsHubShowLab: 'Show laboratory'
    ,islandsHubRuns: 'Runs: {count}'
    ,islandsHubTrend: 'Trend: {trend}'
    ,cosmosIntro: 'Priority map by risk and data freshness.'
  }
} as const;

export type I18nKey = keyof (typeof dict)['ru'];

export const t = (key: I18nKey) => dict[getLang()][key];

export const tf = (key: I18nKey, vars: Record<string, string | number>) => {
  const template = t(key);
  return Object.entries(vars).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template
  );
};
