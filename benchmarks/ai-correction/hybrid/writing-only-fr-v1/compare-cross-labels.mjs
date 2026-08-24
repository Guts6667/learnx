import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { stdout } from 'node:process';
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

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const freeze = readJson('cross-label-reviews.freeze.json');
const authoringPlan = readJson('authoring-plan.preregistered.json');
const targets = [
  {
    authorId: 'A',
    proposalsName: 'author-a.proposals.json',
    mappingName: 'author-a.cross-label.mapping.json',
    labelsName: 'reviewer-b.labels-author-a.json',
  },
  {
    authorId: 'B',
    proposalsName: 'author-b.proposals.json',
    mappingName: 'author-b.cross-label.mapping.json',
    labelsName: 'reviewer-a.labels-author-b.json',
  },
];

const results = [];
let criterionLabelDisagreementCount = 0;
let guardDisagreementCount = 0;
let secondPassDisagreementCount = 0;

for (const target of targets) {
  const frozenReview = freeze.reviews.find(
    (review) => review.targetAuthorId === target.authorId,
  );
  invariant(frozenReview, `Missing frozen review for ${target.authorId}`);
  invariant(
    frozenReview.labelsSha256 === sha256(target.labelsName),
    `Review digest mismatch for ${target.authorId}`,
  );

  const proposals = readJson(target.proposalsName).proposals;
  const proposalsByCaseId = new Map(
    proposals.map((proposal) => [proposal.caseId, proposal]),
  );
  const mapping = readJson(target.mappingName).mapping;
  const mappingByOpaqueId = new Map(
    mapping.map((entry) => [entry.opaqueId, entry]),
  );
  const labels = readJson(target.labelsName).labels;

  for (const label of labels) {
    const mapped = mappingByOpaqueId.get(label.opaqueId);
    invariant(mapped, `Missing mapping for ${label.opaqueId}`);
    const proposal = proposalsByCaseId.get(mapped.caseId);
    invariant(proposal, `Missing proposal ${mapped.caseId}`);

    const expectedByCriterion = new Map(
      proposal.expectedCriteria.map((criterion) => [
        criterion.criterionKey,
        criterion.levelKey,
      ]),
    );
    const reviewerByCriterion = new Map(
      label.criteria.map((criterion) => [
        criterion.criterionKey,
        criterion.levelKey,
      ]),
    );
    const criterionDifferences = proposal.expectedCriteria
      .filter(
        (criterion) =>
          reviewerByCriterion.get(criterion.criterionKey) !== criterion.levelKey,
      )
      .map((criterion) => ({
        criterionKey: criterion.criterionKey,
        authorLevel: criterion.levelKey,
        reviewerLevel: reviewerByCriterion.get(criterion.criterionKey),
      }));

    criterionLabelDisagreementCount += criterionDifferences.length;
    const guardAgrees = proposal.expectedGuardBand === label.guardBand;
    const secondPassAgrees =
      proposal.expectedSecondPass.required === label.secondPassRequired;
    if (!guardAgrees) guardDisagreementCount += 1;
    if (!secondPassAgrees) secondPassDisagreementCount += 1;

    results.push({
      cellId: proposal.cellId,
      caseId: proposal.caseId,
      targetAuthorId: target.authorId,
      reviewerAuthorId: frozenReview.reviewerAuthorId,
      opaqueId: label.opaqueId,
      authorCriteria: Object.fromEntries(expectedByCriterion),
      reviewerCriteria: Object.fromEntries(reviewerByCriterion),
      criterionDifferences,
      authorScore: proposal.expectedScore,
      reviewerScore: label.calculatedScore,
      guardAgrees,
      secondPassAgrees,
      convergent:
        criterionDifferences.length === 0 && guardAgrees && secondPassAgrees,
    });
  }
}

const totalCriterionLabels = results.length * 3;
const disagreementRate = criterionLabelDisagreementCount / totalCriterionLabels;
const byCell = new Map();
for (const result of results) {
  const candidates = byCell.get(result.cellId) ?? [];
  candidates.push(result);
  byCell.set(result.cellId, candidates);
}

const cellsWithoutConvergentProposal = [];
const selected = [];
const preregisteredCellIds = authoringPlan.cellIds;
invariant(
  preregisteredCellIds.length === byCell.size &&
    preregisteredCellIds.every((cellId) => byCell.has(cellId)),
  'Preregistered cell order does not match reviewed cells',
);
for (const [index, cellId] of preregisteredCellIds.entries()) {
  const candidates = byCell.get(cellId);
  invariant(candidates.length === 2, `${cellId}: expected 2 candidates`);
  const preferredAuthorId = index % 2 === 0 ? 'A' : 'B';
  const convergent = candidates.filter((candidate) => candidate.convergent);
  if (convergent.length === 0) {
    cellsWithoutConvergentProposal.push(cellId);
    continue;
  }
  const preferred = convergent.find(
    (candidate) => candidate.targetAuthorId === preferredAuthorId,
  );
  selected.push({
    cellId,
    selectedAuthorId: (preferred ?? convergent[0]).targetAuthorId,
    selectedCaseId: (preferred ?? convergent[0]).caseId,
    preferredAuthorId,
    fallbackUsed: preferred === undefined,
  });
}

const threshold = 0.15;
const gatePasses =
  disagreementRate <= threshold && cellsWithoutConvergentProposal.length === 0;
const output = {
  schemaVersion: 1,
  artifactKind: 'WRITING_ONLY_INTER_AUTHOR_COMPARISON',
  status: gatePasses ? 'GATE_PASSED' : 'STOP_AND_REQUEST_OWNER',
  generatedAt: new Date().toISOString(),
  supersedes: {
    path: 'cross-label-comparison.json',
    sha256: 'ab86c250325420729a13312114b3080fe0891380f5835c11a227796c8ab59a2c',
    reason:
      'The first comparison alternated authors over a lexicographic order instead of the preregistered authoring-plan cellIds order.',
  },
  selectionOrderAuthority: {
    path: 'authoring-plan.preregistered.json',
    sha256: '68c0eabe32198238e133990c1b3f2429e6e855a162b4c190a3d0c5c354df940c',
    field: 'cellIds',
  },
  frozenReviewManifestSha256: sha256('cross-label-reviews.freeze.json'),
  metrics: {
    reviewedProposals: results.length,
    totalCriterionLabels,
    criterionLabelDisagreementCount,
    criterionLabelDisagreementRate: disagreementRate,
    maximumAllowedRate: threshold,
    thresholdRule: 'STOP_ONLY_IF_STRICTLY_GREATER_THAN_0.15',
    guardDisagreementCount,
    secondPassDisagreementCount,
    convergentProposalCount: results.filter((result) => result.convergent).length,
    cellsWithoutConvergentProposal,
  },
  results,
  selection: gatePasses ? selected : [],
  nextAllowedOperation: gatePasses
    ? 'COMPILE_SELECTED_PROPOSALS_INTO_SEALED_CORPUS'
    : 'STOP_AND_REQUEST_OWNER_WITHOUT_REWRITE_OR_THIRD_AUTHOR',
};

writeFileSync(
  join(directory, 'cross-label-comparison.corrected.json'),
  `${JSON.stringify(output, null, 2)}\n`,
);
stdout.write(
  `${output.status}: ${criterionLabelDisagreementCount}/${totalCriterionLabels} (${(
    disagreementRate * 100
  ).toFixed(2)}%), ${cellsWithoutConvergentProposal.length} cells without a convergent proposal\n`,
);
