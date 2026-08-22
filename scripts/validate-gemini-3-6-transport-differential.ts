import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { z } from 'zod';

import {
  assertGemini36TransportDifferential,
  buildGemini36TransportDifferential,
  GEMINI_3_6_TRANSPORT_DIFFERENTIAL_PATHS,
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

const correctedDossierText = await read(
  GEMINI_3_6_TRANSPORT_DIFFERENTIAL_PATHS.correctedDossier,
);
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
  read(GEMINI_3_6_TRANSPORT_DIFFERENTIAL_PATHS.acceptedCampaign),
  read(GEMINI_3_6_TRANSPORT_DIFFERENTIAL_PATHS.acceptedCorpus),
  read(GEMINI_3_6_TRANSPORT_DIFFERENTIAL_PATHS.acceptedResult),
  read(GEMINI_3_6_TRANSPORT_DIFFERENTIAL_PATHS.acceptedRubric),
  read(GEMINI_3_6_TRANSPORT_DIFFERENTIAL_PATHS.correctedFinance),
]);

const report = buildGemini36TransportDifferential({
  acceptedCampaignText,
  acceptedCorpusText,
  acceptedResultText,
  acceptedRubricText,
  correctedAuthorityTexts,
  correctedDossierText,
  correctedFinanceText,
});

assertGemini36TransportDifferential(report);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
