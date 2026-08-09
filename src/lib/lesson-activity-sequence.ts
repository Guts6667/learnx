export type LessonActivityKind =
  | 'CONTENT'
  | 'RESOURCE'
  | 'TASK'
  | 'CONCEPT_ASSESSMENT'
  | 'EXERCISE'
  | 'QUIZ'
  | 'COMPLETE';

export type LessonActivityStatus =
  'AVAILABLE' | 'COMPLETED' | 'IN_PROGRESS' | 'PREVIEW';

export interface LessonActivity {
  estimatedMinutes: number | null;
  href: string;
  id: string;
  kind: LessonActivityKind;
  label: string;
  required: boolean;
  sequenceItemId: string | null;
  status: LessonActivityStatus;
  title: string;
}

export interface LessonActivitySequence {
  activities: LessonActivity[];
  current: LessonActivity | null;
  next: LessonActivity | null;
}

interface PositionedActivity {
  id: string;
  isRequired?: boolean;
  key?: string;
  position: number;
  title?: string | null;
  type?: string;
}

interface ConceptActivity extends PositionedActivity {
  assessments: Array<PositionedActivity & { questionCount?: number | null }>;
}

export interface LessonSequenceInput {
  concepts: ConceptActivity[];
  contentBlocks: Array<PositionedActivity & { type: string }>;
  exercises: PositionedActivity[];
  isPublished: boolean;
  lessonSlug: string;
  nextLesson?: { slug: string; title: string } | null;
  programSlug: string;
  progress?: {
    canComplete: boolean;
    conceptStatus: Record<string, string>;
    exerciseStatus: Record<string, string>;
    lessonStatus: string;
    quizPassed: Record<string, boolean>;
    resourceStatus: Record<string, string>;
    taskStatus: Record<string, string>;
  };
  quizzes: PositionedActivity[];
  resources: Array<PositionedActivity & { estimatedMinutes?: number | null }>;
  sequence?: Array<{
    id?: string;
    key: string;
    kind: Exclude<LessonActivityKind, 'COMPLETE'>;
  }>;
  tasks: PositionedActivity[];
}

const activityLabels: Record<LessonActivityKind, string> = {
  COMPLETE: 'Terminer',
  CONCEPT_ASSESSMENT: 'Vérifier une notion',
  CONTENT: 'Comprendre',
  EXERCISE: 'Mettre en pratique',
  QUIZ: 'Consolider',
  RESOURCE: 'Consulter une ressource',
  TASK: 'Réaliser une tâche',
};

function byPosition<T extends PositionedActivity>(items: T[]): T[] {
  return [...items].sort(
    (left, right) =>
      left.position - right.position || left.id.localeCompare(right.id),
  );
}

export function activityKey(kind: LessonActivityKind, id: string): string {
  return `${kind.toLowerCase()}:${id}`;
}

function activityStorageKey(lessonId: string): string {
  return `learnx:lesson-activity:${lessonId}`;
}

export function readRememberedActivity(lessonId: string): string | null {
  try {
    return window.localStorage.getItem(activityStorageKey(lessonId));
  } catch {
    return null;
  }
}

export function rememberActivity(lessonId: string, key: string): void {
  try {
    window.localStorage.setItem(activityStorageKey(lessonId), key);
  } catch {
    // Storage can be unavailable in private or hardened browser contexts.
  }
}

function lessonHref(programSlug: string, lessonSlug: string): string {
  return `/program/${encodeURIComponent(programSlug)}/lesson/${encodeURIComponent(lessonSlug)}`;
}

function anchoredHref(baseHref: string, key: string): string {
  const encodedKey = encodeURIComponent(key);
  return `${baseHref}?activity=${encodedKey}#activity-${encodedKey}`;
}

function status(
  isPublished: boolean,
  completed: boolean,
  inProgress = false,
): LessonActivityStatus {
  if (!isPublished) return 'PREVIEW';
  if (completed) return 'COMPLETED';
  return inProgress ? 'IN_PROGRESS' : 'AVAILABLE';
}

function createActivity(
  baseHref: string,
  input: Omit<LessonActivity, 'href' | 'label' | 'sequenceItemId'> & {
    href?: string;
    label?: string;
    sequenceItemId?: string | null;
  },
): LessonActivity {
  const key = activityKey(input.kind, input.id);
  return {
    ...input,
    href: input.href ?? anchoredHref(baseHref, key),
    label: input.label ?? activityLabels[input.kind],
    sequenceItemId: input.sequenceItemId ?? null,
  };
}

function isIncompleteRequired(activity: LessonActivity): boolean {
  return activity.required && activity.status !== 'COMPLETED';
}

export function buildLessonActivitySequence(
  input: LessonSequenceInput,
  currentKey?: string | null,
): LessonActivitySequence {
  const baseHref = lessonHref(input.programSlug, input.lessonSlug);
  const progress = input.progress;
  const content = byPosition(input.contentBlocks).map((block) =>
    createActivity(baseHref, {
      estimatedMinutes: null,
      id: block.id,
      kind: 'CONTENT',
      required: true,
      status: status(input.isPublished, progress?.lessonStatus === 'COMPLETED'),
      title: block.title ?? `Contenu ${block.position}`,
    }),
  );
  const resources = byPosition(input.resources).map((resource) =>
    createActivity(baseHref, {
      estimatedMinutes: resource.estimatedMinutes ?? null,
      id: resource.id,
      kind: 'RESOURCE',
      label:
        resource.type === 'VIDEO'
          ? 'Regarder'
          : resource.type === 'PODCAST'
            ? 'Écouter'
            : ['COURSE', 'TOOL', 'WEBSITE'].includes(resource.type ?? '')
              ? 'Explorer'
              : 'Lire',
      required: resource.isRequired ?? false,
      status: status(
        input.isPublished,
        progress?.resourceStatus[resource.id] === 'COMPLETED',
        progress?.resourceStatus[resource.id] === 'STARTED',
      ),
      title: resource.title ?? 'Ressource',
    }),
  );
  const tasks = byPosition(input.tasks).map((task) =>
    createActivity(baseHref, {
      estimatedMinutes: null,
      id: task.id,
      kind: 'TASK',
      required: task.isRequired ?? false,
      status: status(
        input.isPublished,
        progress?.taskStatus[task.id] === 'DONE',
      ),
      title: task.title ?? 'Tâche',
    }),
  );
  const assessments = byPosition(input.concepts).flatMap((concept) =>
    byPosition(concept.assessments).map((assessment) => {
      const key = activityKey('CONCEPT_ASSESSMENT', assessment.id);
      return createActivity(baseHref, {
        estimatedMinutes: null,
        href: `${baseHref}/assessment?assessmentId=${encodeURIComponent(assessment.id)}&activity=${encodeURIComponent(key)}`,
        id: assessment.id,
        kind: 'CONCEPT_ASSESSMENT',
        required: concept.isRequired ?? assessment.isRequired ?? false,
        status: status(
          input.isPublished,
          progress?.conceptStatus[concept.id] === 'VALIDATED',
          progress?.conceptStatus[concept.id] === 'LEARNING',
        ),
        title: assessment.title ?? concept.title ?? 'Mini-évaluation',
      });
    }),
  );
  const exercises = byPosition(input.exercises).map((exercise) => {
    const key = activityKey('EXERCISE', exercise.id);
    const exerciseStatus = progress?.exerciseStatus[exercise.id];
    return createActivity(baseHref, {
      estimatedMinutes: null,
      href: `${baseHref}/exercise/${encodeURIComponent(exercise.id)}?activity=${encodeURIComponent(key)}`,
      id: exercise.id,
      kind: 'EXERCISE',
      required: exercise.isRequired ?? false,
      status: status(
        input.isPublished,
        exerciseStatus === 'SUBMITTED',
        exerciseStatus === 'DRAFT',
      ),
      title: exercise.title ?? 'Exercice',
    });
  });
  const quizzes = byPosition(input.quizzes).map((quiz) => {
    const key = activityKey('QUIZ', quiz.id);
    return createActivity(baseHref, {
      estimatedMinutes: null,
      href: `${baseHref}/quiz?quizId=${encodeURIComponent(quiz.id)}&activity=${encodeURIComponent(key)}`,
      id: quiz.id,
      kind: 'QUIZ',
      required: quiz.isRequired ?? false,
      status: status(input.isPublished, progress?.quizPassed[quiz.id] === true),
      title: quiz.title ?? 'Quiz',
    });
  });
  const completion = createActivity(baseHref, {
    estimatedMinutes: null,
    id: 'lesson',
    kind: 'COMPLETE',
    required: true,
    status: status(
      input.isPublished,
      progress?.lessonStatus === 'COMPLETED',
      progress?.canComplete === true,
    ),
    title: 'Terminer la leçon',
  });
  const legacyActivities = [
    ...content,
    ...tasks,
    ...assessments,
    ...exercises,
    ...quizzes,
  ];
  const candidates = new Map<string, LessonActivity>();
  for (const [items, source] of [
    [content, input.contentBlocks],
    [resources, input.resources],
    [tasks, input.tasks],
    [exercises, input.exercises],
    [quizzes, input.quizzes],
  ] as const) {
    items.forEach((activity, index) => {
      const item = source[index];
      if (item?.key) candidates.set(`${activity.kind}:${item.key}`, activity);
    });
  }
  let assessmentIndex = 0;
  for (const concept of byPosition(input.concepts)) {
    for (const assessment of byPosition(concept.assessments)) {
      const activity = assessments[assessmentIndex++];
      if (activity && assessment.key) {
        candidates.set(`CONCEPT_ASSESSMENT:${assessment.key}`, activity);
      }
    }
  }
  const resolved = input.sequence?.map((item) => {
    const activity = candidates.get(`${item.kind}:${item.key}`);

    return activity
      ? { ...activity, sequenceItemId: item.id ?? null }
      : undefined;
  });
  const canonicalActivities =
    resolved && resolved.length > 0 && resolved.every(Boolean)
      ? (resolved as LessonActivity[])
      : legacyActivities;
  const activities = [...canonicalActivities, completion];
  const currentIndex = currentKey
    ? activities.findIndex(
        (activity) => activityKey(activity.kind, activity.id) === currentKey,
      )
    : -1;
  const current = currentIndex >= 0 ? activities[currentIndex] : null;
  function findNext(
    activityIndex: number,
    activeActivity: LessonActivity | null,
  ): LessonActivity | null {
    const afterCurrent =
      activityIndex >= 0 ? activities.slice(activityIndex + 1) : [];
    return (
      (input.isPublished &&
      activeActivity?.kind !== 'CONTENT' &&
      activeActivity &&
      isIncompleteRequired(activeActivity)
        ? activeActivity
        : afterCurrent.find(isIncompleteRequired)) ??
      activities.find(isIncompleteRequired) ??
      (progress?.lessonStatus === 'COMPLETED' && input.nextLesson
        ? createActivity(baseHref, {
            estimatedMinutes: null,
            href: lessonHref(input.programSlug, input.nextLesson.slug),
            id: input.nextLesson.slug,
            kind: 'CONTENT',
            required: true,
            status: 'AVAILABLE',
            title: input.nextLesson.title,
          })
        : null)
    );
  }

  const firstActivity = current ?? findNext(-1, null);
  const firstActivityIndex = firstActivity
    ? activities.findIndex(
        (activity) =>
          activity.id === firstActivity.id &&
          activity.kind === firstActivity.kind,
      )
    : -1;
  const next = current
    ? findNext(currentIndex, current)
    : findNext(firstActivityIndex, firstActivity);

  return { activities, current: firstActivity, next };
}
