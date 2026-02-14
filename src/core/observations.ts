import { CashflowMonthlyEntry, ObservationsState } from './types';

export const CASHFLOW_MONTHLY_CAP = 36;

const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const sanitizeYm = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return YM_RE.test(normalized) ? normalized : null;
};

const sanitizeAmount = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, numeric);
};

export const sanitizeCashflowMonthly = (
  value: unknown,
  cap = CASHFLOW_MONTHLY_CAP
): CashflowMonthlyEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const byMonth = new Map<string, CashflowMonthlyEntry>();

  value.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }
    const row = item as Record<string, unknown>;
    const ym = sanitizeYm(row.ym);
    if (!ym) {
      return;
    }
    byMonth.set(ym, {
      ym,
      income: sanitizeAmount(row.income),
      expense: sanitizeAmount(row.expense)
    });
  });

  const sorted = [...byMonth.values()].sort((a, b) => a.ym.localeCompare(b.ym));
  const maxItems = Number.isFinite(cap) ? Math.max(1, Math.floor(cap)) : CASHFLOW_MONTHLY_CAP;
  return sorted.slice(-maxItems);
};

export const sanitizeObservations = (value: unknown): ObservationsState => {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    cashflowMonthly: sanitizeCashflowMonthly(source.cashflowMonthly)
  };
};

export const getCurrentYm = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const getNextYm = (ym: string): string => {
  if (!YM_RE.test(ym)) {
    return getCurrentYm();
  }
  const [yearPart, monthPart] = ym.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  const date = new Date(year, month, 1);
  return getCurrentYm(date);
};
