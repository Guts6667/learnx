function getConceptSelect(userId: string) {
  return {
    assessments: {
      where: { isRequired: true },
      select: { id: true, questions: { take: 1, select: { id: true } } },
    },
    id: true,
    progress: {
      where: { userId },
      take: 1,
      select: { status: true },
    },
    title: true,
  } as const;
}

function getExerciseSelect(userId: string) {
  return {
    id: true,
    key: true,
    submissions: {
      where: { userId },
      take: 1,
      select: { status: true },
    },
    title: true,
  } as const;
}

function getLessonModuleSelect(userId: string) {
  return {
    id: true,
    position: true,
    slug: true,
    stage: {
      select: {
        id: true,
        position: true,
        program: {
          select: { id: true, position: true, slug: true, title: true },
        },
        progress: {
          where: { userId },
          take: 1,
          select: { status: true },
        },
        slug: true,
        title: true,
      },
    },
    title: true,
  } as const;
}

function getQuizSelect(userId: string) {
  return {
    attempts: {
      where: { userId },
      orderBy: { submittedAt: 'desc' as const },
      select: { passed: true },
      take: 1,
    },
    id: true,
    title: true,
  } as const;
}

function getTaskSelect(userId: string) {
  return {
    completions: {
      where: { userId },
      take: 1,
      select: { status: true },
    },
    id: true,
    key: true,
    title: true,
  } as const;
}

export function getTodayLessonSelect(userId: string) {
  return {
    activityCompletionCarryovers: {
      where: { userId },
      select: { activityKey: true, kind: true, moduleRunId: true },
    },
    concepts: {
      where: { isRequired: true },
      orderBy: { position: 'asc' as const },
      select: getConceptSelect(userId),
    },
    estimatedMinutes: true,
    exercises: {
      where: { isCanonical: true, isRequired: true },
      orderBy: { position: 'asc' as const },
      select: getExerciseSelect(userId),
    },
    id: true,
    module: { select: getLessonModuleSelect(userId) },
    position: true,
    progress: {
      where: { userId },
      take: 1,
      select: { lastViewedAt: true, status: true },
    },
    quizzes: {
      where: { isRequired: true },
      orderBy: { position: 'asc' as const },
      select: getQuizSelect(userId),
    },
    lessonSequenceItems: {
      orderBy: { position: 'asc' as const },
      select: {
        conceptAssessmentId: true,
        exerciseId: true,
        position: true,
        quizId: true,
        taskId: true,
      },
    },
    slug: true,
    tasks: {
      where: { isCanonical: true, isRequired: true },
      orderBy: { position: 'asc' as const },
      select: getTaskSelect(userId),
    },
    title: true,
  } as const;
}

export function getFinalAssessmentSelect(userId: string) {
  return {
    id: true,
    stage: {
      select: {
        id: true,
        modules: {
          where: { isPublished: true },
          select: {
            lessons: {
              where: { isPublished: true },
              select: {
                progress: {
                  where: { userId },
                  take: 1,
                  select: { status: true },
                },
              },
            },
          },
        },
        position: true,
        program: {
          select: { id: true, position: true, slug: true, title: true },
        },
        progress: {
          where: { userId },
          take: 1,
          select: { status: true },
        },
        slug: true,
        title: true,
      },
    },
    submissions: {
      where: { userId },
      take: 1,
      select: { status: true },
    },
    title: true,
  } as const;
}
