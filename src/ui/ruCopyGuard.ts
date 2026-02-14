const FORBIDDEN_VISIBLE_TERMS = [
  'Actions',
  'Action',
  'Probability',
  'Payoff',
  'Risk tag',
  'Robust',
  'downside',
  'Net',
  'Cashflow drift',
  'Data freshness',
  'EV',
  'EL',
  'HHI',
  'Runway',
  'Coverage',
  'Debt burden',
  'Burn-in',
  'Step size'
] as const;

export const forbiddenVisibleRuTerms = new RegExp(
  FORBIDDEN_VISIBLE_TERMS.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'i'
);

const RU_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Data freshness/gi, 'Актуальность данных'],
  [/Cashflow drift/gi, 'Поток поменялся'],
  [/\bNet\b/gi, 'Итог'],
  [/Risk tag/gi, 'Риск'],
  [/Probability/gi, 'Шанс'],
  [/Payoff/gi, 'Награда'],
  [/Actions?/gi, 'Ходы'],
  [/Robust/gi, 'Устойчивый'],
  [/downside/gi, 'риск потерь'],
  [/Runway/gi, 'запас'],
  [/HHI/gi, 'концентрация'],
  [/Coverage/gi, 'покрытие'],
  [/Debt burden/gi, 'долговая нагрузка'],
  [/Burn-in/gi, 'прогрев'],
  [/Step size/gi, 'шаг']
];

export const sanitizeRuVisibleCopy = (text: string) => {
  let normalized = text;
  for (const [pattern, replacement] of RU_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized.replace(/\b(EV|EL)\b/gi, '').replace(/\s{2,}/g, ' ').trim();
};
