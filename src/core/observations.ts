import {
  CashflowDriftLastState,
  CashflowForecastLastState,
  CashflowMonthlyEntry,
  ObservationsState
} from './types';

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

const clamp01 = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
};

const sanitizeDriftParams = (value: unknown): CashflowDriftLastState['paramsUsed'] => {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const delta = Number(source.delta);
  const lambda = Number(source.lambda);
  const minN = Number(source.minN);
  return {
    delta: Number.isFinite(delta) ? delta : 0.03,
    lambda: Number.isFinite(lambda) ? lambda : 4.2,
    minN: Number.isFinite(minN) ? Math.max(2, Math.floor(minN)) : 8
  };
};

const sanitizeCashflowDriftLast = (value: unknown): CashflowDriftLastState | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const row = value as Record<string, unknown>;
  const ts = typeof row.ts === 'string' && row.ts.trim() ? row.ts : null;
  if (!ts) {
    return undefined;
  }
  const ym = row.ym == null ? null : sanitizeYm(row.ym);
  const score = Number(row.score);
  return {
    detected: Boolean(row.detected),
    score: Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0,
    ym,
    ts,
    paramsUsed: sanitizeDriftParams(row.paramsUsed)
  };
};

const sanitizeForecastMonthly = (
  value: unknown
): CashflowForecastLastState['monthly'] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const monthRaw = Number(row.month);
      const month = Number.isFinite(monthRaw) ? Math.max(1, Math.floor(monthRaw)) : index + 1;
      return {
        month,
        p10: Number.isFinite(Number(row.p10)) ? Number(row.p10) : 0,
        p50: Number.isFinite(Number(row.p50)) ? Number(row.p50) : 0,
        p90: Number.isFinite(Number(row.p90)) ? Number(row.p90) : 0
      };
    })
    .filter((item): item is CashflowForecastLastState['monthly'][number] => Boolean(item));
};


const sanitizeForecastMethod = (value: unknown): CashflowForecastLastState['methodsUsed'][number] | null => {
  if (value === 'iid_bootstrap' || value === 'moving_block_bootstrap' || value === 'linear_trend_bootstrap') {
    return value;
  }
  return null;
};

const sanitizePerMethodSummary = (value: unknown): NonNullable<CashflowForecastLastState['perMethodSummary']> => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const method = sanitizeForecastMethod(row.method);
      if (!method) return null;
      const quantiles = row.quantiles && typeof row.quantiles === 'object'
        ? (row.quantiles as Record<string, unknown>)
        : {};
      return {
        method,
        probNetNegative: clamp01(row.probNetNegative),
        uncertainty: Number.isFinite(Number(row.uncertainty)) ? Math.max(0, Number(row.uncertainty)) : 0,
        quantiles: {
          p10: Number.isFinite(Number(quantiles.p10)) ? Number(quantiles.p10) : 0,
          p50: Number.isFinite(Number(quantiles.p50)) ? Number(quantiles.p50) : 0,
          p90: Number.isFinite(Number(quantiles.p90)) ? Number(quantiles.p90) : 0
        }
      };
    })
    .filter((item): item is NonNullable<CashflowForecastLastState['perMethodSummary']>[number] => Boolean(item));
};

const sanitizeCashflowForecastLast = (value: unknown): CashflowForecastLastState | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  const ts = typeof row.ts === 'string' && row.ts.trim() ? row.ts : null;
  if (!ts) return undefined;
  const paramsUsed = row.paramsUsed && typeof row.paramsUsed === 'object'
    ? (row.paramsUsed as Record<string, unknown>)
    : {};
  const quantiles = row.quantiles && typeof row.quantiles === 'object'
    ? (row.quantiles as Record<string, unknown>)
    : {};

  const sourceMonthsRaw = Number(paramsUsed.sourceMonths);
  const iterationsRaw = Number(paramsUsed.iterations);
  const seedRaw = Number(paramsUsed.seed);
  const horizonRaw = Number(row.horizonMonths);

  return {
    ts,
    horizonMonths: Number.isFinite(horizonRaw) ? Math.max(1, Math.floor(horizonRaw)) : 3,
    paramsUsed: {
      iterations: Number.isFinite(iterationsRaw) ? Math.max(1, Math.floor(iterationsRaw)) : 2000,
      sourceMonths: Number.isFinite(sourceMonthsRaw) ? Math.max(0, Math.floor(sourceMonthsRaw)) : 0,
      ...(Number.isFinite(seedRaw) ? { seed: Math.floor(seedRaw) } : {}),
      ...(paramsUsed.mode === 'single' || paramsUsed.mode === 'ensemble' ? { mode: paramsUsed.mode } : {})
    },
    probNetNegative: clamp01(row.probNetNegative),
    quantiles: {
      p10: Number.isFinite(Number(quantiles.p10)) ? Number(quantiles.p10) : 0,
      p50: Number.isFinite(Number(quantiles.p50)) ? Number(quantiles.p50) : 0,
      p90: Number.isFinite(Number(quantiles.p90)) ? Number(quantiles.p90) : 0
    },
    uncertainty: Number.isFinite(Number(row.uncertainty)) ? Math.max(0, Number(row.uncertainty)) : 0,
    ...(Array.isArray(row.methodsUsed)
      ? {
          methodsUsed: row.methodsUsed
            .map((item) => sanitizeForecastMethod(item))
            .filter((item): item is NonNullable<CashflowForecastLastState['methodsUsed']>[number] => Boolean(item))
        }
      : {}),
    ...(Number.isFinite(Number(row.disagreementScore))
      ? { disagreementScore: Math.max(0, Math.min(1, Number(row.disagreementScore))) }
      : {}),
    ...(Array.isArray(row.perMethodSummary)
      ? { perMethodSummary: sanitizePerMethodSummary(row.perMethodSummary) }
      : {}),
    monthly: sanitizeForecastMonthly(row.monthly)
  };
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
  const cashflowDriftLast = sanitizeCashflowDriftLast(source.cashflowDriftLast);
  const cashflowForecastLast = sanitizeCashflowForecastLast(source.cashflowForecastLast);
  return {
    cashflowMonthly: sanitizeCashflowMonthly(source.cashflowMonthly),
    ...(cashflowDriftLast ? { cashflowDriftLast } : {}),
    ...(cashflowForecastLast ? { cashflowForecastLast } : {})
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
