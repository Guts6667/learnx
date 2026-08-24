import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export async function expectNoSeriousA11yViolations(
  page: Page,
  scope?: string,
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
  ]);
  if (scope) builder = builder.include(scope);
  const results = await builder.analyze();
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
