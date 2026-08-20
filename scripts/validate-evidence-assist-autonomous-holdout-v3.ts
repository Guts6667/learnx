import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import {
  canonicalAutonomousHoldoutJson,
  validateEvidenceAssistAutonomousHoldout,
} from '../src/lib/evidence-assist-autonomous-holdout.ts';
import { compileExecutableRubric } from '../src/lib/executable-rubric-engine.ts';

const rootDirectory = process.cwd();
const prefix = '--plaintext=';
const plaintextArgument = process.argv
  .find((value) => value.startsWith(prefix))
  ?.slice(prefix.length);
if (!plaintextArgument) {
  throw new Error('AUTONOMOUS_HOLDOUT_PLAINTEXT_ARGUMENT_MISSING');
}
const plaintextPath = resolve(plaintextArgument);
if (!relative(rootDirectory, plaintextPath).startsWith('..')) {
  throw new Error('AUTONOMOUS_HOLDOUT_PLAINTEXT_MUST_STAY_OUTSIDE_REPOSITORY');
}

const compiled = compileExecutableRubric(
  JSON.parse(
    readFileSync(
      resolve(
        rootDirectory,
        'benchmarks/ai-correction/executable-rubric/writing-go-no-go-recommendation-fr.v2.json',
      ),
      'utf8',
    ),
  ) as unknown,
);
const holdout = JSON.parse(readFileSync(plaintextPath, 'utf8')) as unknown;
const { holdout: validatedHoldout, summary } =
  validateEvidenceAssistAutonomousHoldout({
    compiled,
    holdout,
  });
const plaintextSha256 = createHash('sha256')
  .update(canonicalAutonomousHoldoutJson(validatedHoldout))
  .digest('hex');
process.stdout.write(`${JSON.stringify({ plaintextSha256, summary })}\n`);
