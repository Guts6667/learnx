import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [labelsPathArgument, packetPathArgument] = process.argv.slice(2);
if (!labelsPathArgument || !packetPathArgument) {
  throw new Error('Usage: node validate-cross-labels.mjs <labels.json> <packet.json>');
}

const labelsPath = resolve(labelsPathArgument);
const packetPath = resolve(packetPathArgument);
const labels = JSON.parse(readFileSync(labelsPath, 'utf8'));
const packetBytes = readFileSync(packetPath);
const packet = JSON.parse(packetBytes);
const packetSha256 = createHash('sha256').update(packetBytes).digest('hex');

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

invariant(labels.schemaVersion === 1, 'labels schemaVersion must be 1');
invariant(
  labels.artifactKind === 'WRITING_ONLY_BLIND_CROSS_LABELS',
  'invalid labels artifactKind',
);
invariant(labels.packetSha256 === packetSha256, 'packet digest mismatch');
invariant(
  labels.reviewerAuthorId === packet.reviewerAuthorId,
  'reviewerAuthorId mismatch',
);
invariant(
  labels.targetAuthorId === packet.targetAuthorId,
  'targetAuthorId mismatch',
);
invariant(
  labels.sourceProposalOrMappingConsulted === false,
  'source proposal or mapping must not be consulted',
);
invariant(
  labels.candidateOutputsConsulted === false,
  'candidate outputs must not be consulted',
);
invariant(
  labels.networkOrModelCallsMade === false,
  'network/model calls must be false',
);
invariant(Array.isArray(labels.labels), 'labels.labels must be an array');
invariant(
  labels.labels.length === packet.items.length,
  `expected ${packet.items.length} labels, got ${labels.labels.length}`,
);

const allowedLevels = new Set(['mastered', 'partial', 'limited', 'insufficient']);
const levelValues = { mastered: 100, partial: 65, limited: 35, insufficient: 0 };
const itemsById = new Map(packet.items.map((item) => [item.opaqueId, item]));
const seen = new Set();

for (const label of labels.labels) {
  invariant(typeof label.opaqueId === 'string', 'opaqueId must be a string');
  invariant(!seen.has(label.opaqueId), `duplicate opaqueId ${label.opaqueId}`);
  seen.add(label.opaqueId);
  const item = itemsById.get(label.opaqueId);
  invariant(item, `unknown opaqueId ${label.opaqueId}`);
  invariant(Array.isArray(label.criteria), `${label.opaqueId}: criteria must be array`);
  invariant(
    label.criteria.length === item.rubric.criteria.length,
    `${label.opaqueId}: expected ${item.rubric.criteria.length} criteria`,
  );

  const expectedCriterionKeys = new Set(
    item.rubric.criteria.map((criterion) => criterion.key),
  );
  const observedCriterionKeys = new Set();
  let weightedTotal = 0;

  for (const criterionLabel of label.criteria) {
    invariant(
      expectedCriterionKeys.has(criterionLabel.criterionKey),
      `${label.opaqueId}: unknown criterion ${criterionLabel.criterionKey}`,
    );
    invariant(
      !observedCriterionKeys.has(criterionLabel.criterionKey),
      `${label.opaqueId}: duplicate criterion ${criterionLabel.criterionKey}`,
    );
    invariant(
      allowedLevels.has(criterionLabel.levelKey),
      `${label.opaqueId}: invalid level ${criterionLabel.levelKey}`,
    );
    observedCriterionKeys.add(criterionLabel.criterionKey);
    const criterion = item.rubric.criteria.find(
      (candidate) => candidate.key === criterionLabel.criterionKey,
    );
    weightedTotal += criterion.weight * levelValues[criterionLabel.levelKey];
  }

  const calculatedScore = weightedTotal / 100;
  invariant(
    Math.abs(label.calculatedScore - calculatedScore) < 1e-9,
    `${label.opaqueId}: score ${label.calculatedScore} != ${calculatedScore}`,
  );
  const guardBand =
    Math.abs(calculatedScore - item.rubric.passingScore) <= 5;
  invariant(
    label.guardBand === guardBand,
    `${label.opaqueId}: guardBand must be ${guardBand}`,
  );
  invariant(
    label.secondPassRequired === guardBand,
    `${label.opaqueId}: secondPassRequired must be ${guardBand}`,
  );
  invariant(
    typeof label.rationale === 'string' && label.rationale.trim().length > 0,
    `${label.opaqueId}: rationale required`,
  );
}

for (const opaqueId of itemsById.keys()) {
  invariant(seen.has(opaqueId), `missing label ${opaqueId}`);
}

console.log(
  `${labels.reviewerAuthorId}->${labels.targetAuthorId}: ${labels.labels.length} blind cross-labels valid`,
);
