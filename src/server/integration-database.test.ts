import { requireEphemeralIntegrationDatabase } from '@/server/integration-database';

const neonUrl =
  'postgresql://owner:secret@ep-test-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';

describe('integration database safety', () => {
  it('accepte uniquement une branche éphémère explicitement identifiée', () => {
    expect(
      requireEphemeralIntegrationDatabase({
        DATABASE_URL: neonUrl,
        LEARNX_INTEGRATION_DATABASE: 'ephemeral',
        LEARNX_INTEGRATION_RUN_ID: 'run-42',
        NEON_BRANCH_ID: 'br-test-42',
      }),
    ).toEqual({ branchId: 'br-test-42', runId: 'run-42' });
  });

  it('refuse une base ordinaire ou un contexte incomplet', () => {
    expect(() =>
      requireEphemeralIntegrationDatabase({ DATABASE_URL: neonUrl }),
    ).toThrow('LEARNX_INTEGRATION_DATABASE=ephemeral');
    expect(() =>
      requireEphemeralIntegrationDatabase({
        DATABASE_URL: 'postgresql://owner:secret@database.example.com/db',
        LEARNX_INTEGRATION_DATABASE: 'ephemeral',
        LEARNX_INTEGRATION_RUN_ID: 'run-42',
        NEON_BRANCH_ID: 'br-test-42',
      }),
    ).toThrow('Neon branch');
  });
});
