import {
  activityKey,
  buildLessonActivitySequence,
  readRememberedActivity,
  rememberActivity,
  type LessonSequenceInput,
} from '@/lib/lesson-activity-sequence';

function fixture(): LessonSequenceInput {
  return {
    concepts: [
      {
        assessments: [
          { id: 'assessment-1', isRequired: true, position: 1, title: 'Notion' },
        ],
        id: 'concept-1',
        isRequired: true,
        position: 1,
        title: 'Concept',
      },
    ],
    contentBlocks: [{ id: 'block-1', position: 1, type: 'RICH_TEXT' }],
    exercises: [{ id: 'exercise-1', isRequired: true, position: 1, title: 'Exercice' }],
    isPublished: true,
    lessonSlug: 'lecon',
    programSlug: 'programme',
    progress: {
      canComplete: false,
      conceptStatus: { 'concept-1': 'NOT_STARTED' },
      exerciseStatus: {},
      lessonStatus: 'IN_PROGRESS',
      quizPassed: {},
      resourceStatus: {},
      taskStatus: {},
    },
    quizzes: [{ id: 'quiz-1', isRequired: true, position: 1, title: 'Quiz' }],
    resources: [
      {
        estimatedMinutes: 5,
        id: 'resource-1',
        isRequired: true,
        position: 1,
        title: 'Ressource',
      },
    ],
    tasks: [{ id: 'task-1', isRequired: true, position: 1, title: 'Tâche' }],
  };
}

describe('lesson activity sequence', () => {
  it('ordonne les phases sans mélanger leurs positions techniques', () => {
    const sequence = buildLessonActivitySequence(fixture());

    expect(sequence.activities.map((activity) => activity.kind)).toEqual([
      'CONTENT',
      'TASK',
      'CONCEPT_ASSESSMENT',
      'EXERCISE',
      'QUIZ',
      'COMPLETE',
    ]);
    expect(sequence.current?.id).toBe('block-1');
    expect(sequence.next?.id).toBe('task-1');
  });

  it('reprend après l’activité identifiée dans l’URL', () => {
    const input = fixture();
    if (!input.progress) throw new Error('Missing progress fixture.');
    input.progress.taskStatus['task-1'] = 'DONE';
    const sequence = buildLessonActivitySequence(
      input,
      activityKey('TASK', 'task-1'),
    );

    expect(sequence.current?.id).toBe('task-1');
    expect(sequence.next?.id).toBe('assessment-1');
    expect(sequence.next?.href).toContain('assessmentId=assessment-1');
  });

  it('ignore une activité optionnelle non commencée pour Continuer', () => {
    const input = fixture();
    input.resources[0].isRequired = false;
    if (!input.progress) throw new Error('Missing progress fixture.');
    input.progress.taskStatus['task-1'] = 'DONE';
    const sequence = buildLessonActivitySequence(
      input,
      activityKey('CONTENT', 'block-1'),
    );

    expect(sequence.next?.id).toBe('assessment-1');
  });

  it('rend une séquence brouillon prévisualisable sans état accompli', () => {
    const input = fixture();
    input.isPublished = false;
    input.progress = undefined;
    const sequence = buildLessonActivitySequence(input);

    expect(sequence.activities.every((activity) => activity.status === 'PREVIEW')).toBe(true);
  });

  it('passe à la leçon suivante après complétion', () => {
    const input = fixture();
    if (!input.progress) throw new Error('Missing progress fixture.');
    input.nextLesson = { slug: 'suite', title: 'Leçon suivante' };
    input.progress.lessonStatus = 'COMPLETED';
    input.progress.resourceStatus['resource-1'] = 'COMPLETED';
    input.progress.taskStatus['task-1'] = 'DONE';
    input.progress.conceptStatus['concept-1'] = 'VALIDATED';
    input.progress.exerciseStatus['exercise-1'] = 'SUBMITTED';
    input.progress.quizPassed['quiz-1'] = true;

    const sequence = buildLessonActivitySequence(input, 'complete:lesson');

    expect(sequence.next).toMatchObject({
      href: '/program/programme/lesson/suite',
      title: 'Leçon suivante',
    });
  });
});

describe('lesson activity memory', () => {
  afterEach(() => window.localStorage.clear());

  it('mémorise le dernier emplacement significatif par leçon', () => {
    rememberActivity('lesson-1', 'task:task-1');

    expect(readRememberedActivity('lesson-1')).toBe('task:task-1');
    expect(readRememberedActivity('lesson-2')).toBeNull();
  });
});
