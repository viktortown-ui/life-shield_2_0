import { Lang, getLang } from './i18n';

const resolveLang = (lang?: Lang): Lang => lang ?? getLang();

export const formatNumber = (
  value: number,
  options?: Intl.NumberFormatOptions,
  lang?: Lang
) => new Intl.NumberFormat(resolveLang(lang), options).format(value);

export const formatMoney = (
  value: number,
  options?: Intl.NumberFormatOptions,
  lang?: Lang
) =>
  new Intl.NumberFormat(resolveLang(lang), {
    style: 'currency',
    currency: resolveLang(lang) === 'ru' ? 'RUB' : 'USD',
    maximumFractionDigits: 0,
    ...options
  }).format(value);

export const formatPercent = (value: number, digits = 0, lang?: Lang) =>
  new Intl.NumberFormat(resolveLang(lang), {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);

export const formatDateTime = (
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
  lang?: Lang
) =>
  new Intl.DateTimeFormat(resolveLang(lang), options ?? { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value)
  );
