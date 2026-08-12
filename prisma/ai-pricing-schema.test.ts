import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve('prisma/migrations/20260812170000_add_ai_pricing_catalog/migration.sql'),
  'utf8',
);
const api = readFileSync(
  resolve('src/server/api/ai-pricing/app.ts'),
  'utf8',
);

describe('V4-007 versioned AI pricing schema', () => {
  it('stores immutable versioned measured catalogs and quote snapshots', () => {
    expect(schema).toContain('model AiPricingCatalogVersion');
    expect(schema).toContain('model AiPricingCatalogEntry');
    expect(schema).toContain('model AiPricingQuote');
    expect(schema).toContain('benchmarkId');
    expect(schema).toContain('corpusId');
    expect(schema).toContain('promptVersion');
    expect(schema).toContain('providerMedianCostUsdSnapshot');
    expect(schema).toContain('providerP90CostUsdSnapshot');
    expect(migration).toContain('AI pricing quotes are immutable');
    expect(migration).toContain('An activated pricing catalog is immutable');
  });

  it('supports inactive catalogs and actions without seeding fictitious prices', () => {
    expect(migration).toContain("('draft', 'inactive', 'active', 'retired')");
    expect(migration).toContain('DEFAULT \'draft\'');
    expect(migration).toContain('ai_pricing_future_action_disabled_check');
    expect(migration).toContain('ai_pricing_reinforced_evidence_check');
    expect(migration).not.toMatch(/INSERT INTO "ai_pricing_catalog/);
  });

  it('enforces integer credit bounds and measured size segments', () => {
    expect(migration).toContain('provider_median_cost_credits" BIGINT');
    expect(migration).toContain('provider_p90_cost_credits" BIGINT');
    expect(migration).toContain('"ceiling_credits" >= "estimated_credits"');
    expect(migration).toContain('"max_input_chars" >= "min_input_chars"');
    expect(migration).toContain('"safety_coefficient" >= 1');
  });

  it('prevents the learner from supplying price or catalog fields', () => {
    const requestContract = api.slice(
      api.indexOf('const requestSchema'),
      api.indexOf('export interface AiPricingAppOptions'),
    );
    expect(api).toContain('.strict()');
    expect(requestContract).not.toMatch(
      /(estimatedCredits|ceilingCredits|catalogVersion):/,
    );
    expect(api).toContain("'PRICING_UNAVAILABLE'");
    expect(api).toContain('No correction will be started');
  });

  it('keeps supplier economics out of the learner quote response', () => {
    const responseStart = api.indexOf('return context.json(');
    const response = api.slice(responseStart);
    expect(response).not.toContain('providerMedianCostUsd');
    expect(response).not.toContain('targetMarginCredits');
    expect(response).not.toContain('safetyCoefficient');
    expect(response).not.toContain('modelId:');
    expect(response).toContain('maximumReservedCredits');
    expect(response).toContain('includesAutomaticSecondPass');
    expect(response).toContain('ACTUAL_USAGE_ONLY');
  });
});
