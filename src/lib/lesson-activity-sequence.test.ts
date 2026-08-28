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
          {
            id: 'assessment-1',
            isRequired: true,
            key: 'assessment',
            position: 1,
            title: 'Notion',
          },
        ],
        id: 'concept-1',
        isRequired: true,
        position: 1,
        title: 'Concept',
      },
    ],
    contentBlocks: [
      { id: 'block-1', key: 'content', position: 1, type: 'RICH_TEXT' },
    ],
    exercises: [
      {
        id: 'exercise-1',
        isRequired: true,
        key: 'exercise',
        position: 1,
        title: 'Exercice',
      },
    ],
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
    quizzes: [
      {
        id: 'quiz-1',
        isRequired: true,
        key: 'quiz',
        position: 1,
        title: 'Quiz',
      },
    ],
    resources: [
      {
        estimatedMinutes: 5,
        id: 'resource-1',
        isRequired: true,
        key: 'resource',
        position: 1,
        title: 'Ressource',
      },
    ],
    tasks: [
      {
        id: 'task-1',
        isRequired: true,
        key: 'task',
        position: 1,
        title: 'Tâche',
      },
    ],
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

  it('nomme un contenu depuis son premier titre Markdown', () => {
    const input = fixture();
    input.contentBlocks[0].content = {
      text: [
        'Une introduction avant le titre.',
        '',
        '```text',
        '## Ceci est du code',
        '```',
        '',
        '## Suivre une `requête` **HTTP** ##',
        '',
        'Le détail de la séquence.',
      ].join('\n'),
    };

    const sequence = buildLessonActivitySequence(input);

    expect(sequence.activities[0].title).toBe('Suivre une requête HTTP');
  });

  it('préfère le titre explicite puis conserve le fallback existant', () => {
    const input = fixture();
    input.contentBlocks = [
      {
        content: { text: '## Titre Markdown' },
        id: 'block-titled',
        position: 1,
        title: 'Titre éditorial',
        type: 'RICH_TEXT',
      },
      {
        content: { text: 'Un paragraphe sans titre.' },
        id: 'block-fallback',
        position: 2,
        type: 'RICH_TEXT',
      },
    ];

    const contentTitles = buildLessonActivitySequence(input)
      .activities.filter((activity) => activity.kind === 'CONTENT')
      .map((activity) => activity.title);

    expect(contentTitles).toEqual(['Titre éditorial', 'Contenu 2']);
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

  it('ne reboucle pas vers une mini-évaluation déjà validée', () => {
    const input = fixture();
    if (!input.progress) throw new Error('Missing progress fixture.');
    input.sequence = [
      { kind: 'CONCEPT_ASSESSMENT', key: 'assessment' },
      { kind: 'CONTENT', key: 'content-3' },
      { kind: 'CONTENT', key: 'content-4' },
    ];
    input.contentBlocks = [
      {
        id: 'block-3',
        key: 'content-3',
        position: 3,
        type: 'RICH_TEXT',
      },
      {
        id: 'block-4',
        key: 'content-4',
        position: 4,
        type: 'RICH_TEXT',
      },
    ];
    input.exercises = [];
    input.quizzes = [];
    input.resources = [];
    input.tasks = [];
    input.progress.conceptStatus['concept-1'] = 'VALIDATED';
    input.progress.canComplete = true;

    const sequence = buildLessonActivitySequence(
      input,
      activityKey('CONTENT', 'block-4'),
    );

    expect(sequence.next).toMatchObject({
      id: 'lesson',
      kind: 'COMPLETE',
    });
    expect(sequence.next?.id).not.toBe('assessment-1');
  });

  it('respecte l’ordre inter-types fourni par le serveur', () => {
    const input = fixture();
    input.sequence = [
      { kind: 'RESOURCE', key: 'resource' },
      { kind: 'CONTENT', key: 'content' },
      { kind: 'CONCEPT_ASSESSMENT', key: 'assessment' },
      { kind: 'TASK', key: 'task' },
      { kind: 'QUIZ', key: 'quiz' },
      { kind: 'EXERCISE', key: 'exercise' },
    ];

    expect(
      buildLessonActivitySequence(input).activities.map((item) => item.kind),
    ).toEqual([
      'RESOURCE',
      'CONTENT',
      'CONCEPT_ASSESSMENT',
      'TASK',
      'QUIZ',
      'EXERCISE',
      'COMPLETE',
    ]);
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

    expect(
      sequence.activities.every((activity) => activity.status === 'PREVIEW'),
    ).toBe(true);
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
