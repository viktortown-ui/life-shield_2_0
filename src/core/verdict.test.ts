import { describe, expect, it } from 'vitest';
import { calculateChaos, weightedMedian } from './verdict';

describe('weightedMedian', () => {
  it('returns the weighted median for uneven weights', () => {
    const scores = [20, 50, 90];
    const weights = [1, 10, 1];
    expect(weightedMedian(scores, weights)).toBe(50);
  });

  it('falls back to median when weights are zero', () => {
    const scores = [10, 30, 40, 80];
    const weights = [0, 0, 0, 0];
    expect(weightedMedian(scores, weights)).toBe(35);
  });
});

describe('calculateChaos', () => {
  it('clamps chaos between 0 and 1', () => {
    expect(calculateChaos([50, 50, 50])).toBe(0);
    expect(calculateChaos([0, 200])).toBe(1);
  });
});
