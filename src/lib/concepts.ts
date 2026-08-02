export type ConceptMasteryStatus =
  'LEARNING' | 'NEEDS_REVIEW' | 'NOT_STARTED' | 'VALIDATED';

export function assertRequiredConceptHasValidationActivity(input: {
  assessmentCount: number;
  isRequired: boolean;
}): void {
  if (input.isRequired && input.assessmentCount === 0) {
    throw new Error('A required concept must define a validation activity.');
  }
}

export function calculateConceptStatus(input: {
  hasResourceActivity: boolean;
  persistedStatus: ConceptMasteryStatus;
}): ConceptMasteryStatus {
  if (input.persistedStatus !== 'NOT_STARTED') {
    return input.persistedStatus;
  }

  return input.hasResourceActivity ? 'LEARNING' : 'NOT_STARTED';
}

export function isConceptValidated(status: ConceptMasteryStatus): boolean {
  return status === 'VALIDATED';
}
