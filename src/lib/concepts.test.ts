import {
  assertRequiredConceptHasValidationActivity,
  calculateConceptStatus,
  isConceptValidated,
} from '@/lib/concepts';

describe('concept mastery rules', () => {
  it('exige une activité de validation pour une notion obligatoire', () => {
    expect(() =>
      assertRequiredConceptHasValidationActivity({
        assessmentCount: 0,
        isRequired: true,
      }),
    ).toThrow('A required concept must define a validation activity.');
    expect(() =>
      assertRequiredConceptHasValidationActivity({
        assessmentCount: 0,
        isRequired: false,
      }),
    ).not.toThrow();
  });

  it('place une notion en apprentissage après consultation d’une ressource', () => {
    const status = calculateConceptStatus({
      hasResourceActivity: true,
      persistedStatus: 'NOT_STARTED',
    });

    expect(status).toBe('LEARNING');
    expect(isConceptValidated(status)).toBe(false);
  });

  it('ne remplace jamais un état de maîtrise persisté', () => {
    expect(
      calculateConceptStatus({
        hasResourceActivity: false,
        persistedStatus: 'VALIDATED',
      }),
    ).toBe('VALIDATED');
    expect(isConceptValidated('VALIDATED')).toBe(true);
  });
});
