import { describe, expect, it } from 'vitest';
import {
  DecisionTreeInput,
  computeDecisionTreeMetrics
} from './decisionTree';

describe('decisionTree metrics', () => {
  it('computes EV and robust choice', () => {
    const input: DecisionTreeInput = {
      actions: [
        {
          name: 'A',
          outcomes: [
            { probability: 0.5, payoff: 10, riskTag: 'med' },
            { probability: 0.5, payoff: -2, riskTag: 'high' }
          ]
        },
        {
          name: 'B',
          outcomes: [{ probability: 1, payoff: 3, riskTag: 'low' }]
        }
      ]
    };

    const summary = computeDecisionTreeMetrics(input);
    const actionA = summary.actions.find((action) => action.name === 'A');

    expect(actionA?.ev).toBeCloseTo(4, 5);
    expect(summary.bestByEV?.name).toBe('A');
    expect(summary.robustChoice?.name).toBe('B');
  });
});
