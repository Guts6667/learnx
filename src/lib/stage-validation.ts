export type StageValidationProgressStatus =
  'AVAILABLE' | 'COMPLETED' | 'IN_PROGRESS' | 'LOCKED';

export type StageRequirementType =
  'FINAL_ASSESSMENT' | 'REQUIRED_CONCEPT' | 'REQUIRED_TASK';

export interface StageRequirement {
  id: string | null;
  title: string;
  type: StageRequirementType;
}

export interface StageValidationItem {
  id: string;
  isValidated: boolean;
  title: string;
}

export interface StageValidationInput {
  currentStatus: StageValidationProgressStatus;
  finalAssessments: StageValidationItem[];
  hasStarted: boolean;
  requiredConcepts: StageValidationItem[];
  requiredTasks: StageValidationItem[];
}

export interface StageValidationResult {
  finalAssessments: { total: number; validated: number };
  isValidated: boolean;
  missingRequirements: StageRequirement[];
  requiredConcepts: { total: number; validated: number };
  requiredTasks: { total: number; validated: number };
  status: StageValidationProgressStatus;
}

function countValidated(items: StageValidationItem[]) {
  return items.filter((item) => item.isValidated).length;
}

export function getMissingStageRequirements(
  input: Pick<
    StageValidationInput,
    'finalAssessments' | 'requiredConcepts' | 'requiredTasks'
  >,
): StageRequirement[] {
  const requirements: StageRequirement[] = [
    ...input.requiredConcepts
      .filter((concept) => !concept.isValidated)
      .map((concept) => ({
        id: concept.id,
        title: concept.title,
        type: 'REQUIRED_CONCEPT' as const,
      })),
    ...input.requiredTasks
      .filter((task) => !task.isValidated)
      .map((task) => ({
        id: task.id,
        title: task.title,
        type: 'REQUIRED_TASK' as const,
      })),
  ];

  if (input.finalAssessments.length === 0) {
    requirements.push({
      id: null,
      title: 'Évaluation finale obligatoire',
      type: 'FINAL_ASSESSMENT',
    });
  } else {
    requirements.push(
      ...input.finalAssessments
        .filter((assessment) => !assessment.isValidated)
        .map((assessment) => ({
          id: assessment.id,
          title: assessment.title,
          type: 'FINAL_ASSESSMENT' as const,
        })),
    );
  }

  return requirements;
}

export function isStageValidated(
  input: Pick<
    StageValidationInput,
    'finalAssessments' | 'requiredConcepts' | 'requiredTasks'
  >,
): boolean {
  return getMissingStageRequirements(input).length === 0;
}

function calculateStatus(
  input: StageValidationInput,
  validated: boolean,
): StageValidationProgressStatus {
  if (input.currentStatus === 'LOCKED') return 'LOCKED';
  if (validated) return 'COMPLETED';
  if (!input.hasStarted && input.currentStatus === 'AVAILABLE') {
    return 'AVAILABLE';
  }
  return 'IN_PROGRESS';
}

export function calculateStageValidation(
  input: StageValidationInput,
): StageValidationResult {
  const missingRequirements = getMissingStageRequirements(input);
  const validated = missingRequirements.length === 0;

  return {
    finalAssessments: {
      total: input.finalAssessments.length,
      validated: countValidated(input.finalAssessments),
    },
    isValidated: validated,
    missingRequirements,
    requiredConcepts: {
      total: input.requiredConcepts.length,
      validated: countValidated(input.requiredConcepts),
    },
    requiredTasks: {
      total: input.requiredTasks.length,
      validated: countValidated(input.requiredTasks),
    },
    status: calculateStatus(input, validated),
  };
}
