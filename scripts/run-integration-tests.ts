import { spawnSync } from 'node:child_process';

import { requireEphemeralIntegrationDatabase } from '../src/server/integration-database.js';

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

requireEphemeralIntegrationDatabase();
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

run(pnpm, ['build']);
run(pnpm, [
  'exec',
  'playwright',
  'test',
  '--config=playwright.integration.config.ts',
]);
