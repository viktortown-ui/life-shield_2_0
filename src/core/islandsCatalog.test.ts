import { describe, expect, it } from 'vitest';
import { islandsCatalog } from './islandsCatalog';
import { getState, resetState } from './store';

describe('islandsCatalog', () => {
  it('covers every island id from store', () => {
    resetState();
    const state = getState();
    const storeIds = Object.keys(state.islands).sort();
    const catalogIds = Object.keys(islandsCatalog).sort();
    expect(catalogIds).toEqual(storeIds);
  });
});
