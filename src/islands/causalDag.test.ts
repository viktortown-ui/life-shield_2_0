import { describe, expect, it } from 'vitest';
import { analyzeCausalDag } from './causalDag';

describe('causalDag engine', () => {
  it('finds adjustment set Z for confounded X->Y', () => {
    const analysis = analyzeCausalDag({
      edges: [
        { from: 'Z', to: 'X' },
        { from: 'Z', to: 'Y' },
        { from: 'X', to: 'Y' }
      ],
      exposure: 'X',
      outcome: 'Y',
      controls: [],
      mediators: []
    });

    expect(analysis.adjustmentSets).toContainEqual(['Z']);
  });

  it('detects collider when controlled', () => {
    const analysis = analyzeCausalDag({
      edges: [
        { from: 'X', to: 'C' },
        { from: 'Z', to: 'C' },
        { from: 'Z', to: 'Y' },
        { from: 'X', to: 'Y' }
      ],
      exposure: 'X',
      outcome: 'Y',
      controls: ['C'],
      mediators: []
    });

    expect(analysis.colliders).toContain('C');
    expect(analysis.badControls.colliders).toContain('C');
  });
});
