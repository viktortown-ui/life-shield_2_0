export const clamp01 = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
};

export const normalizeRatio = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return value > 1 ? clamp01(value / 100) : clamp01(value);
};

export const normalizeWeights = <T extends string>(weights: Record<T, number>, available: T[]) => {
  const valid = available
    .map((key) => ({ key, weight: Number.isFinite(weights[key]) ? Math.max(0, weights[key]) : 0 }))
    .filter((item) => item.weight > 0);

  const total = valid.reduce((acc, item) => acc + item.weight, 0);
  if (total <= 0) return new Map<T, number>();

  return new Map(valid.map((item) => [item.key, item.weight / total]));
};
