import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));

function readJson(name) {
  return JSON.parse(readFileSync(join(directory, name), 'utf8'));
}

function sha256(name) {
  return createHash('sha256')
    .update(readFileSync(join(directory, name)))
    .digest('hex');
}

const semantics = readJson('criterion-semantics.preregistered.json');
const freeze = readJson('author-proposals.freeze.json');
const frozenByAuthor = new Map(
  freeze.batches.map((batch) => [batch.authorId, batch]),
);

for (const targetAuthorId of ['A', 'B']) {
  const reviewerAuthorId = targetAuthorId === 'A' ? 'B' : 'A';
  const sourceName = `author-${targetAuthorId.toLowerCase()}.proposals.json`;
  const source = readJson(sourceName);
  const frozen = frozenByAuthor.get(targetAuthorId);

  if (!frozen || frozen.sha256 !== sha256(sourceName)) {
    throw new Error(`Frozen digest mismatch for author ${targetAuthorId}`);
  }

  const contractsByKey = new Map(
    semantics.contracts.map((contract) => [contract.contractKey, contract]),
  );
  const mapping = [];
  const items = source.proposals.map((proposal, index) => {
    const contract = contractsByKey.get(proposal.contractKey);
    if (!contract) {
      throw new Error(`Unknown contract ${proposal.contractKey}`);
    }

    const opaqueId = `cross-${targetAuthorId.toLowerCase()}-${String(index + 1).padStart(3, '0')}`;
    mapping.push({
      opaqueId,
      targetAuthorId,
      cellId: proposal.cellId,
      caseId: proposal.caseId,
    });

    return {
      opaqueId,
      contractKey: proposal.contractKey,
      contractVersion: proposal.contractVersion,
      taskContext: proposal.taskContext,
      taskPrompt: proposal.taskPrompt,
      responseText: proposal.responseText,
      rubric: {
        passingScore: contract.passingScore,
        criteria: contract.criteria,
        commonLevelSemantics: semantics.commonLevelSemantics,
        ownershipRule: semantics.ownershipRule,
        feedbackProbeArbitration: semantics.feedbackProbeArbitration,
      },
    };
  });

  const packetName = `author-${targetAuthorId.toLowerCase()}.cross-label.blind.json`;
  writeFileSync(
    join(directory, packetName),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        artifactKind: 'WRITING_ONLY_BLIND_CROSS_LABEL_PACKET',
        status: 'FROZEN_FOR_INDEPENDENT_CROSS_LABELING',
        targetAuthorId,
        reviewerAuthorId,
        targetBatchSha256: frozen.sha256,
        criterionSemanticsSha256: freeze.criterionSemanticsSha256,
        labelInstructions: {
          outputOneLabelPerOpaqueId: true,
          allowedLevels: ['mastered', 'partial', 'limited', 'insufficient'],
          requiredFields: [
            'opaqueId',
            'criteria',
            'calculatedScore',
            'guardBand',
            'secondPassRequired',
            'rationale',
          ],
          criterionCount: 3,
          scoreFormula:
            'sum(weight * levelValue) / 100, with mastered=100, partial=65, limited=35, insufficient=0',
          guardRule: 'abs(calculatedScore - passingScore) <= 5',
          independenceRule:
            'Judge only the supplied task, response and frozen rubric. Do not consult the source proposal file, mapping, candidate model outputs or the other reviewer.',
        },
        items,
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    join(directory, `author-${targetAuthorId.toLowerCase()}.cross-label.mapping.json`),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        artifactKind: 'WRITING_ONLY_CROSS_LABEL_PRIVATE_MAPPING',
        status: 'SEALED_UNTIL_REVIEW_LABELS_ARE_FROZEN',
        targetAuthorId,
        targetBatchSha256: frozen.sha256,
        packetPath: packetName,
        mapping,
      },
      null,
      2,
    )}\n`,
  );
}
