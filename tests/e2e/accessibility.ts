import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export async function expectNoSeriousA11yViolations(
  page: Page,
): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blockingViolations = results.violations.filter(({ impact }) =>
    impact === 'serious' || impact === 'critical',
  );

  expect(
    blockingViolations,
    blockingViolations
      .map(
        ({ help, id, nodes }) =>
          `${id}: ${help} (${nodes.length} occurrence(s))`,
      )
      .join('\n'),
  ).toEqual([]);
}
