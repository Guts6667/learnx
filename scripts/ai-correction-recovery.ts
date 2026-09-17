import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  createBlankRecoveryReference,
  prepareRecoveryPack,
  recoveryBlindReview,
} from '../src/lib/ai-correction-recovery-pack';
import {
  evaluateRecoveryPilot,
  recoveryHash,
  createRecoveryLock,
} from '../src/lib/ai-correction-recovery-evaluation';
import { RECOVERY_RUBRIC } from '../src/lib/ai-correction-recovery-contract';

const [command, ...args] = process.argv.slice(2);
const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(resolve(path), 'utf8')) as unknown;
const writeNew = async (path: string, value: unknown) =>
  writeFile(resolve(path), `${JSON.stringify(value, null, 2)}\n`, {
    flag: 'wx',
  });

async function main() {
  if (command === 'prepare' && args.length === 2) {
    const source = await readJson(args[0]);
    if (!Array.isArray(source))
      throw new Error('Source input must be an array.');
    const pack = prepareRecoveryPack(source, 'OWNER_SUPPLIED');
    const directory = resolve(args[1]);
    await mkdir(directory, { recursive: false });
    await writeNew(`${directory}/pack.json`, pack);
    await writeNew(`${directory}/sources.private.json`, source);
    await writeNew(
      `${directory}/reference.draft.json`,
      createBlankRecoveryReference(pack),
    );
    await writeNew(`${directory}/review.blind.json`, recoveryBlindReview(pack));
    await writeNew(
      `${directory}/retest.blind.json`,
      recoveryBlindReview(pack, true),
    );
    await writeNew(`${directory}/rubric.json`, RECOVERY_RUBRIC);
    await writeNew(`${directory}/seal.json`, {
      packHash: recoveryHash(pack),
      sourceHash: recoveryHash(source),
      createdAt: new Date().toISOString(),
      status: 'OWNER_REVIEW_REQUIRED',
    });
    console.log(
      `Prepared ${directory}. No labels, provider calls, or qualification results were invented.`,
    );
    return;
  }
  if (command === 'lock' && args.length === 3) {
    const lock = createRecoveryLock(
      await readJson(args[0]),
      await readJson(args[1]),
      new Date().toISOString(),
    );
    await writeNew(args[2], lock);
    console.log(
      'Reference lock written. Commit the pack, reference and lock before collecting model outputs.',
    );
    return;
  }
  if (command === 'evaluate' && args.length === 5) {
    const report = evaluateRecoveryPilot(
      await readJson(args[0]),
      await readJson(args[1]),
      await readJson(args[2]),
      await readJson(args[3]),
    );
    await writeNew(args[4], report);
    console.log(
      `Pilot evidence: ${report.status}. No deployment or model promotion performed.`,
    );
    return;
  }
  throw new Error(
    'Usage: pnpm ai:recovery prepare <30-sources.json> <new-directory> | lock <pack.json> <reference.json> <new-lock.json> | evaluate <pack.json> <reference.json> <lock.json> <run.json> <new-report.json>',
  );
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Recovery command failed.',
  );
  process.exitCode = 1;
});
