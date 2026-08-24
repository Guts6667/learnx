import { log } from 'node:console';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const planPath = resolve(directory, 'authoring-plan.preregistered.json');
const semanticsPath = resolve(directory, 'criterion-semantics.preregistered.json');
const plan = readJson(planPath);
const semantics = readJson(semanticsPath);
const levelScores = new Map(
  plan.performanceLevels.map((level) => [level.key, level.score]),
);
const contracts = new Map(
  semantics.contracts.map((contract) => [contract.archetype, contract]),
);
const mandatoryProbeByCell = new Map(
  plan.mandatoryWritingProbes.map((probe) => [probe.assignedCellId, probe.probeId]),
);
const expectedCells = new Set(plan.cellIds);

const inputPaths = argv.slice(2).map((path) => resolve(path));
invariant(inputPaths.length > 0, 'AUTHOR_PROPOSAL_PATH_REQUIRED');

for (const inputPath of inputPaths) {
  const artifact = readJson(inputPath);
  invariant(artifact.schemaVersion === 1, 'AUTHOR_SCHEMA_VERSION_INVALID');
  invariant(
    artifact.artifactKind === 'WRITING_ONLY_AUTHOR_PROPOSALS',
    'AUTHOR_ARTIFACT_KIND_INVALID',
  );
  invariant(['A', 'B'].includes(artifact.authorId), 'AUTHOR_ID_INVALID');
  invariant(
    artifact.status === 'DRAFT_READY_FOR_DIGEST_FREEZE',
    'AUTHOR_STATUS_INVALID',
  );
  invariant(artifact.candidateOutputsConsulted === false, 'AUTHOR_OUTPUT_LEAK');
  invariant(artifact.networkOrModelCallsMade === false, 'AUTHOR_NETWORK_CALL');
  invariant(
    artifact.authoringPlanSha256 === sha256(planPath),
    'AUTHOR_PLAN_DIGEST_MISMATCH',
  );
  invariant(
    artifact.criterionSemanticsSha256 === sha256(semanticsPath),
    'AUTHOR_SEMANTICS_DIGEST_MISMATCH',
  );
  invariant(Array.isArray(artifact.proposals), 'AUTHOR_PROPOSALS_REQUIRED');
  invariant(
    artifact.proposals.length === plan.caseCount,
    'AUTHOR_PROPOSAL_COUNT_INVALID',
  );

  const seenCells = new Set();
  const seenCases = new Set();
  const prefix = `author-${artifact.authorId.toLowerCase()}-`;
  for (const proposal of artifact.proposals) {
    invariant(expectedCells.has(proposal.cellId), `UNKNOWN_CELL:${proposal.cellId}`);
    invariant(!seenCells.has(proposal.cellId), `DUPLICATE_CELL:${proposal.cellId}`);
    seenCells.add(proposal.cellId);
    invariant(
      typeof proposal.caseId === 'string' && proposal.caseId.startsWith(prefix),
      `CASE_PREFIX_INVALID:${proposal.cellId}`,
    );
    invariant(!seenCases.has(proposal.caseId), `DUPLICATE_CASE:${proposal.caseId}`);
    seenCases.add(proposal.caseId);
    invariant(proposal.contractVersion === '1.0.0', `CONTRACT_VERSION:${proposal.cellId}`);

    const contract = contracts.get(proposal.archetype);
    invariant(contract !== undefined, `UNKNOWN_ARCHETYPE:${proposal.cellId}`);
    invariant(contract.contractKey === proposal.contractKey, `CONTRACT_KEY:${proposal.cellId}`);
    invariant(
      proposal.cellId.includes(proposal.archetype.toLowerCase().replaceAll('_', '-')),
      `ARCHETYPE_CELL_MISMATCH:${proposal.cellId}`,
    );
    invariant(
      proposal.cellId.endsWith(proposal.profile.toLowerCase().replaceAll('_', '-')),
      `PROFILE_CELL_MISMATCH:${proposal.cellId}`,
    );
    for (const field of ['taskContext', 'taskPrompt', 'responseText', 'goldRationale']) {
      invariant(
        typeof proposal[field] === 'string' && proposal[field].trim().length >= 20,
        `TEXT_FIELD_INVALID:${proposal.cellId}:${field}`,
      );
    }
    invariant(
      Array.isArray(proposal.expectedCriteria) &&
        proposal.expectedCriteria.length === contract.criteria.length,
      `EXPECTED_CRITERIA_COUNT:${proposal.cellId}`,
    );
    const actualCriteria = new Map(
      proposal.expectedCriteria.map((criterion) => [criterion.criterionKey, criterion.levelKey]),
    );
    invariant(
      actualCriteria.size === contract.criteria.length,
      `EXPECTED_CRITERIA_DUPLICATE:${proposal.cellId}`,
    );
    let expectedScore = 0;
    for (const criterion of contract.criteria) {
      const levelKey = actualCriteria.get(criterion.key);
      invariant(levelScores.has(levelKey), `LEVEL_INVALID:${proposal.cellId}:${criterion.key}`);
      expectedScore += levelScores.get(levelKey) * criterion.weight / 100;
    }
    invariant(
      Math.abs(proposal.expectedScore - expectedScore) < 1e-9,
      `EXPECTED_SCORE_MISMATCH:${proposal.cellId}:${expectedScore}`,
    );
    const expectedGuardBand =
      Math.abs(expectedScore - contract.passingScore) <= plan.scoreGuard.pointsInclusive;
    invariant(
      proposal.expectedGuardBand === expectedGuardBand,
      `GUARD_BAND_MISMATCH:${proposal.cellId}`,
    );
    invariant(
      proposal.expectedSecondPass?.required === expectedGuardBand,
      `SECOND_PASS_MISMATCH:${proposal.cellId}`,
    );
    invariant(
      typeof proposal.expectedSecondPass?.rationale === 'string' &&
        proposal.expectedSecondPass.rationale.trim().length >= 20,
      `SECOND_PASS_RATIONALE:${proposal.cellId}`,
    );
    const expectedProbe = mandatoryProbeByCell.get(proposal.cellId) ?? null;
    invariant(
      proposal.mandatoryProbeId === expectedProbe,
      `MANDATORY_PROBE_MISMATCH:${proposal.cellId}`,
    );
  }
  invariant(seenCells.size === expectedCells.size, 'AUTHOR_CELL_COVERAGE_INVALID');
  log(`${artifact.authorId}: ${artifact.proposals.length} proposals valid (${inputPath})`);
}
