import { describe, expect, it } from 'vitest';
import { getCatalogByGroup } from '../core/islandsCatalog';
import { getIslandsHubVisibleIds } from './islandsHub';

describe('islands hub visibility', () => {
  it('hides lab islands by default', () => {
    const visibleIds = getIslandsHubVisibleIds(false);
    const baseIds = getCatalogByGroup('base').map((item) => item.id);
    const labIds = getCatalogByGroup('lab').map((item) => item.id);

    expect(visibleIds).toEqual(baseIds);
    labIds.forEach((id) => {
      expect(visibleIds).not.toContain(id);
    });
  });
});
