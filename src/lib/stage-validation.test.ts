import {
  calculateStageValidation,
  getMissingStageRequirements,
  isStageValidated,
  type StageValidationInput,
} from '@/lib/stage-validation';

function validInput(): StageValidationInput {
  return {
    currentStatus: 'IN_PROGRESS',
    finalAssessments: [
      { id: 'assessment-1', isValidated: true, title: 'Étude de cas' },
    ],
    hasStarted: true,
    requiredConcepts: [
      { id: 'concept-1', isValidated: true, title: 'Notion 1' },
      { id: 'concept-2', isValidated: true, title: 'Notion 2' },
    ],
    requiredExercises: [
      { id: 'exercise-1', isValidated: true, title: 'Production 1' },
    ],
    requiredTasks: [{ id: 'task-1', isValidated: true, title: 'Exercice 1' }],
  };
}

describe('stage validation', () => {
  it('termine l’étape lorsque toutes les exigences sont validées', () => {
    const result = calculateStageValidation(validInput());

    expect(result).toMatchObject({
      finalAssessments: { total: 1, validated: 1 },
      isValidated: true,
      missingRequirements: [],
      requiredConcepts: { total: 2, validated: 2 },
      requiredExercises: { total: 1, validated: 1 },
      requiredTasks: { total: 1, validated: 1 },
      status: 'COMPLETED',
    });
    expect(isStageValidated(validInput())).toBe(true);
  });

  it('liste chaque notion, tâche et évaluation obligatoire manquante', () => {
    const input = validInput();
    input.requiredConcepts[1].isValidated = false;
    input.requiredTasks[0].isValidated = false;
    input.finalAssessments[0].isValidated = false;

    expect(getMissingStageRequirements(input)).toEqual([
      {
        id: 'concept-2',
        title: 'Notion 2',
        type: 'REQUIRED_CONCEPT',
      },
      { id: 'task-1', title: 'Exercice 1', type: 'REQUIRED_TASK' },
      {
        id: 'assessment-1',
        title: 'Étude de cas',
        type: 'FINAL_ASSESSMENT',
      },
    ]);
    expect(isStageValidated(input)).toBe(false);
  });

  it('signale explicitement l’absence d’évaluation finale obligatoire', () => {
    const input = validInput();
    input.finalAssessments = [];

    expect(calculateStageValidation(input)).toMatchObject({
      isValidated: false,
      missingRequirements: [
        {
          id: null,
          title: 'Évaluation finale obligatoire',
          type: 'FINAL_ASSESSMENT',
        },
      ],
      status: 'IN_PROGRESS',
    });
  });

  it('préserve les états verrouillé et disponible avant démarrage', () => {
    const locked = validInput();
    locked.currentStatus = 'LOCKED';
    locked.finalAssessments[0].isValidated = false;
    expect(calculateStageValidation(locked).status).toBe('LOCKED');

    const available = validInput();
    available.currentStatus = 'AVAILABLE';
    available.hasStarted = false;
    available.requiredTasks[0].isValidated = false;
    expect(calculateStageValidation(available).status).toBe('AVAILABLE');
  });

  it('rétrograde une étape terminée devenue incomplète', () => {
    const input = validInput();
    input.currentStatus = 'COMPLETED';
    input.requiredTasks[0].isValidated = false;

    expect(calculateStageValidation(input).status).toBe('IN_PROGRESS');
  });
});
