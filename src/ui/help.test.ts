import { describe, expect, it } from 'vitest';
import { createHelpIconButton, getHelpTopics } from './help';

describe('help content', () => {
  it('contains required key modules', () => {
    const ids = getHelpTopics().map((topic) => topic.id);
    expect(ids).toEqual(
      expect.arrayContaining(['islandsHub', 'timeseries', 'snapshot', 'stressTest', 'bayes'])
    );
  });

  it('renders help icon button with aria-label', () => {
    const button = createHelpIconButton('snapshot');
    const ariaLabel = button.getAttribute('aria-label') ?? '';
    expect(ariaLabel.length).toBeGreaterThan(3);
    expect(ariaLabel).toContain(':');
    expect(button.textContent).toBe('?');
  });
});
