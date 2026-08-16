export type EvidenceStatusComparison = {
  actual: string | undefined;
  caseId: string;
  expected: string;
};

export type EvidencePanelAgreementRequirements = {
  atomicStatusAgreementMinimum: number;
  criticalCaseAtomicAgreementRate?: number;
  criticalCaseIds?: readonly string[];
  falseNotDemonstratedCountMaximum: number;
  falseSupportedCount: number;
  variabilityRateMaximum: number;
};

export type EvidencePanelAgreementMetrics = {
  atomicStatusAgreementRate: number;
  criticalCaseAtomicAgreementRate: number;
  criticalElementComparisons: number;
  falseNotDemonstratedCount: number;
  falseSupportedCount: number;
  requirementsPassed: boolean;
  variabilityRate: number;
};

const agreementRate = (
  comparisons: readonly EvidenceStatusComparison[],
): number =>
  comparisons.length === 0
    ? 0
    : comparisons.filter(({ actual, expected }) => actual === expected).length /
      comparisons.length;

export function calculateEvidencePanelAgreementMetrics(input: {
  comparisons: readonly EvidenceStatusComparison[];
  requirements: EvidencePanelAgreementRequirements;
  totalCases: number;
  variabilityCaseCount: number;
}): EvidencePanelAgreementMetrics {
  const criticalCaseIds = new Set(input.requirements.criticalCaseIds ?? []);
  const criticalComparisons = input.comparisons.filter(({ caseId }) =>
    criticalCaseIds.has(caseId),
  );
  const atomicStatusAgreementRate = agreementRate(input.comparisons);
  const criticalCaseAtomicAgreementRate =
    criticalCaseIds.size === 0 ? 1 : agreementRate(criticalComparisons);
  const falseSupportedCount = input.comparisons.filter(
    ({ actual, expected }) => actual === 'SUPPORTED' && expected !== 'SUPPORTED',
  ).length;
  const falseNotDemonstratedCount = input.comparisons.filter(
    ({ actual, expected }) =>
      actual === 'NOT_DEMONSTRATED' && expected !== 'NOT_DEMONSTRATED',
  ).length;
  const variabilityRate =
    input.totalCases === 0 ? 0 : input.variabilityCaseCount / input.totalCases;
  const criticalRequirement =
    input.requirements.criticalCaseAtomicAgreementRate ?? 1;
  return {
    atomicStatusAgreementRate,
    criticalCaseAtomicAgreementRate,
    criticalElementComparisons: criticalComparisons.length,
    falseNotDemonstratedCount,
    falseSupportedCount,
    requirementsPassed:
      atomicStatusAgreementRate >=
        input.requirements.atomicStatusAgreementMinimum &&
      criticalCaseAtomicAgreementRate >= criticalRequirement &&
      falseSupportedCount === input.requirements.falseSupportedCount &&
      falseNotDemonstratedCount <=
        input.requirements.falseNotDemonstratedCountMaximum &&
      variabilityRate <= input.requirements.variabilityRateMaximum,
    variabilityRate,
  };
}
