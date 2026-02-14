import { Lang } from '../ui/i18n';

export type GlossaryKey =
  | 'runway'
  | 'debtBurden'
  | 'coverage'
  | 'hhi'
  | 'topShare'
  | 'avgStability'
  | 'burnIn'
  | 'stepSize'
  | 'simulations'
  | 'horizon'
  | 'seasonLength'
  | 'testSize'
  | 'auto';

interface GlossaryEntry {
  ru: { simple: string; pro?: string };
  en: { simple: string; pro?: string };
}

const glossary: Record<GlossaryKey, GlossaryEntry> = {
  runway: {
    ru: { simple: 'Запас (мес)', pro: 'Runway' },
    en: { simple: 'Runway (months)' }
  },
  debtBurden: {
    ru: { simple: 'Долговая нагрузка', pro: 'Debt burden' },
    en: { simple: 'Debt burden' }
  },
  coverage: {
    ru: { simple: 'Покрытие расходов', pro: 'Coverage' },
    en: { simple: 'Coverage' }
  },
  hhi: {
    ru: { simple: 'Концентрация дохода', pro: 'HHI' },
    en: { simple: 'HHI' }
  },
  topShare: {
    ru: { simple: 'Доля главного источника', pro: 'Top share' },
    en: { simple: 'Top share' }
  },
  avgStability: {
    ru: { simple: 'Средняя стабильность', pro: 'Avg stability' },
    en: { simple: 'Average stability' }
  },
  burnIn: {
    ru: { simple: 'Прогрев (итерации)', pro: 'Burn-in' },
    en: { simple: 'Burn-in' }
  },
  stepSize: {
    ru: { simple: 'Шаг', pro: 'Step size' },
    en: { simple: 'Step size' }
  },
  simulations: {
    ru: { simple: 'Симуляций', pro: 'Simulations' },
    en: { simple: 'Simulations' }
  },
  horizon: {
    ru: { simple: 'Горизонт', pro: 'Horizon' },
    en: { simple: 'Horizon' }
  },
  seasonLength: {
    ru: { simple: 'Сезонность', pro: 'Season length' },
    en: { simple: 'Season length' }
  },
  testSize: {
    ru: { simple: 'Доля теста', pro: 'Test size' },
    en: { simple: 'Test size' }
  },
  auto: {
    ru: { simple: 'Авто', pro: 'Auto' },
    en: { simple: 'Auto' }
  }
};

export const getMetricLabel = (
  key: GlossaryKey,
  options: { proTerms: boolean; lang: Lang }
): { label: string; proHint?: string } => {
  const entry = glossary[key][options.lang];
  if (options.lang === 'ru' && options.proTerms && entry.pro) {
    return { label: `${entry.simple} (${entry.pro})`, proHint: entry.pro };
  }
  return { label: entry.simple };
};
