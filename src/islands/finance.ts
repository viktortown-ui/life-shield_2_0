import { FinanceInputData } from '../core/types';
import { reportCaughtError } from '../core/reportError';

export const defaultFinanceInput: FinanceInputData = {
  monthlyIncome: 180000,
  monthlyExpenses: 120000,
  reserveCash: 360000,
  monthlyDebtPayment: 25000,
  incomeSourcesCount: 1,
  top1Share: 0.8,
  top3Share: 1
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const readNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const parseFinanceInput = (raw: string): FinanceInputData => {
  if (!raw.trim()) {
    return defaultFinanceInput;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FinanceInputData>;
    return {
      monthlyIncome: readNumber(parsed.monthlyIncome, defaultFinanceInput.monthlyIncome),
      monthlyExpenses: readNumber(
        parsed.monthlyExpenses,
        defaultFinanceInput.monthlyExpenses
      ),
      reserveCash: readNumber(parsed.reserveCash, defaultFinanceInput.reserveCash),
      monthlyDebtPayment: readNumber(
        parsed.monthlyDebtPayment,
        defaultFinanceInput.monthlyDebtPayment
      ),
      incomeSourcesCount: Math.max(
        1,
        Math.round(
          readNumber(parsed.incomeSourcesCount, defaultFinanceInput.incomeSourcesCount)
        )
      ),
      top1Share: clamp(readNumber(parsed.top1Share, defaultFinanceInput.top1Share ?? 0.8), 0, 1),
      top3Share: clamp(readNumber(parsed.top3Share, defaultFinanceInput.top3Share ?? 1), 0, 1),
      incomeSources: Array.isArray(parsed.incomeSources)
        ? parsed.incomeSources
            .map((source) => ({
              amount: readNumber(source?.amount, 0),
              stability: clamp(readNumber(source?.stability, 3), 1, 5)
            }))
            .filter((source) => source.amount > 0)
        : undefined
    };
  } catch (error) {
    reportCaughtError(error);
  }

  const lines = raw.split(/\n+/).map((line) => line.trim());
  const next = { ...defaultFinanceInput };
  lines.forEach((line) => {
    const [name, value] = line.split(/[:=]/).map((part) => part.trim());
    if (!name || value === undefined) return;
    const lower = name.toLowerCase();
    if (lower.includes('income') || lower.includes('доход')) {
      next.monthlyIncome = readNumber(value, next.monthlyIncome);
    } else if (lower.includes('expense') || lower.includes('расход')) {
      next.monthlyExpenses = readNumber(value, next.monthlyExpenses);
    } else if (lower.includes('reserve') || lower.includes('резерв')) {
      next.reserveCash = readNumber(value, next.reserveCash);
    } else if (lower.includes('debt') || lower.includes('долг')) {
      next.monthlyDebtPayment = readNumber(value, next.monthlyDebtPayment);
    } else if (lower.includes('source') || lower.includes('источник')) {
      next.incomeSourcesCount = Math.max(1, Math.round(readNumber(value, next.incomeSourcesCount)));
    }
  });
  return next;
};

export const serializeFinanceInput = (input: FinanceInputData) =>
  JSON.stringify(input, null, 2);
