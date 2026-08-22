import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { z } from 'zod';

import {
  assertGemini36TransportDifferential,
  buildGemini36TransportDifferential,
  gemini36TransportDifferentialPaths,
  type Gemini36TransportDifferentialCandidate,
} from '../src/server/ai/gemini-3-6-transport-differential.ts';

const dossierAuthoritySchema = z.object({
  authorities: z.record(
    z.string(),
    z.object({ path: z.string().min(1) }).passthrough(),
  ),
});

async function read(path: string): Promise<string> {
  return readFile(resolve(path), 'utf8');
}

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

const candidateValue = option('candidate') ?? 'gemini-3.6';
if (candidateValue !== 'gemini-3.6' && candidateValue !== 'gemini-3.6-r1') {
  throw new Error(`GEMINI_DIFFERENTIAL_UNKNOWN_CANDIDATE:${candidateValue}`);
}
const candidate: Gemini36TransportDifferentialCandidate = candidateValue;
const paths = gemini36TransportDifferentialPaths(candidate);

const correctedDossierText = await read(paths.correctedDossier);
const dossier = dossierAuthoritySchema.parse(
  JSON.parse(correctedDossierText) as unknown,
);
const correctedAuthorityTexts = Object.fromEntries(
  await Promise.all(
    Object.values(dossier.authorities).map(async ({ path }) => [
      path,
      await read(path),
    ]),
  ),
);

const [
  acceptedCampaignText,
  acceptedCorpusText,
  acceptedResultText,
  acceptedRubricText,
  correctedFinanceText,
] = await Promise.all([
  read(paths.acceptedCampaign),
  read(paths.acceptedCorpus),
  read(paths.acceptedResult),
  read(paths.acceptedRubric),
  read(paths.correctedFinance),
]);

const report = buildGemini36TransportDifferential({
  acceptedCampaignText,
  acceptedCorpusText,
  acceptedResultText,
  acceptedRubricText,
  candidate,
  correctedAuthorityTexts,
  correctedDossierText,
  correctedFinanceText,
});

assertGemini36TransportDifferential(report);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
