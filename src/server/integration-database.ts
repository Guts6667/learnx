export interface IntegrationDatabaseIdentity {
  branchId: string;
  runId: string;
}

export function requireEphemeralIntegrationDatabase(
  environment: NodeJS.ProcessEnv = process.env,
): IntegrationDatabaseIdentity {
  const databaseUrl = environment.DATABASE_URL;
  const branchId = environment.NEON_BRANCH_ID?.trim();
  const runId = environment.LEARNX_INTEGRATION_RUN_ID?.trim();

  if (environment.LEARNX_INTEGRATION_DATABASE !== 'ephemeral') {
    throw new Error(
      'LEARNX_INTEGRATION_DATABASE=ephemeral is required for integration writes.',
    );
  }

  if (!databaseUrl || !branchId || !runId) {
    throw new Error(
      'DATABASE_URL, NEON_BRANCH_ID and LEARNX_INTEGRATION_RUN_ID are required.',
    );
  }

  const hostname = new URL(databaseUrl).hostname;
  const isNeonBranch = hostname.endsWith('.neon.tech');
  const isExplicitLocalDatabase =
    environment.LEARNX_INTEGRATION_ALLOW_LOCAL === 'true' &&
    ['127.0.0.1', 'localhost'].includes(hostname);

  if (!isNeonBranch && !isExplicitLocalDatabase) {
    throw new Error(
      'Integration writes require a Neon branch or explicit local database.',
    );
  }

  return { branchId, runId };
}
