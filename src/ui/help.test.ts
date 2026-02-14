import { describe, expect, it } from 'vitest';
import { createHelpIconButton, getHelpTopics } from './help';

describe('help content', () => {
  it('contains required key modules', () => {
    const ids = getHelpTopics().map((topic) => topic.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'islandsHub',
        'timeseries',
        'snapshot',
        'stressTest',
        'bayes',
        'incomePortfolio'
      ])
    );
  });

  it('renders help icon button with accessibility links', () => {
    const button = createHelpIconButton('snapshot');
    const ariaLabel = button.getAttribute('aria-label') ?? '';
    const describedBy = button.getAttribute('aria-describedby') ?? '';
    expect(ariaLabel.length).toBeGreaterThan(3);
    expect(ariaLabel).toContain(':');
    expect(button.textContent).toContain('?');
    expect(describedBy).toContain('help-topic-desc-snapshot');
    expect(button.querySelector(`#${describedBy}`)).not.toBeNull();
  });
});
