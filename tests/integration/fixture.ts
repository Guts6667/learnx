import {
  ConceptAssessmentType,
  ConceptQuestionType,
  ContentBlockType,
  LessonSequenceKind,
  ProgramStatus,
  QuizQuestionType,
  ResourceType,
  Role,
  StageAssessmentType,
  TaskType,
} from '../../generated/prisma/client.js';
import { requireEphemeralIntegrationDatabase } from '../../src/server/integration-database.js';

export interface IntegrationFixture {
  conceptAssessmentId: string;
  conceptCorrectOptionId: string;
  conceptWrongOptionId: string;
  conceptQuestionId: string;
  exerciseId: string;
  lessonId: string;
  lessonSlug: string;
  moduleSlug: string;
  moduleId: string;
  ownerEmail: string;
  programId: string;
  programSlug: string;
  quizCorrectOptionId: string;
  quizId: string;
  quizQuestionId: string;
  resourceId: string;
  stageAssessmentId: string;
  stageId: string;
  stageSlug: string;
  taskId: string;
}

function suffix(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function createIntegrationFixture(
  ownerEmail: string,
  testSuffix: string,
): Promise<IntegrationFixture> {
  requireEphemeralIntegrationDatabase();
  const { prisma } = await import('../../src/server/prisma.js');
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail } });

  if (!owner)
    throw new Error(`Integration owner ${ownerEmail} does not exist.`);

  await prisma.user.update({
    where: { id: owner.id },
    data: { role: Role.ADMIN },
  });

  const key = suffix(testSuffix);
  const programSlug = `integration-${key}`;
  const stageSlug = `stage-${key}`;
  const moduleSlug = `module-${key}`;
  const lessonSlug = `lesson-${key}`;
  const program = await prisma.program.create({
    data: {
      canonicalProgramKey: programSlug,
      description: 'Programme isolé pour les tests d’intégration LearnX.',
      estimatedDurationDays: 1,
      ownerId: owner.id,
      position: 1,
      slug: programSlug,
      status: ProgramStatus.ACTIVE,
      title: `Programme intégration ${key}`,
    },
  });
  const stage = await prisma.stage.create({
    data: {
      canonicalKey: stageSlug,
      description: 'Étape publiée de test.',
      estimatedDurationDays: 1,
      estimatedMinutes: 30,
      isPublished: true,
      position: 1,
      programId: program.id,
      slug: stageSlug,
      title: 'Étape intégration',
    },
  });
  const module = await prisma.module.create({
    data: {
      canonicalKey: moduleSlug,
      description: 'Module publié de test.',
      estimatedMinutes: 30,
      isPublished: true,
      position: 1,
      slug: moduleSlug,
      stageId: stage.id,
      title: 'Module intégration',
    },
  });
  const lesson = await prisma.lesson.create({
    data: {
      canonicalKey: lessonSlug,
      estimatedMinutes: 30,
      isPublished: true,
      moduleId: module.id,
      objectives: ['Vérifier le contrat réel de LearnX'],
      position: 1,
      prerequisites: [],
      slug: lessonSlug,
      summary: 'Leçon complète réservée aux tests d’intégration.',
      title: 'Leçon intégration réelle',
    },
  });

  const contentBlock = await prisma.contentBlock.create({
    data: {
      content: { text: 'Contenu pédagogique réel de la fixture.' },
      key: 'content-1',
      lessonId: lesson.id,
      position: 1,
      type: ContentBlockType.RICH_TEXT,
    },
  });
  const resource = await prisma.resource.create({
    data: {
      description: 'Lire la ressource de test.',
      estimatedMinutes: 2,
      isRequired: true,
      key: `resource-${key}`,
      lessonId: lesson.id,
      position: 1,
      title: 'Ressource intégration',
      type: ResourceType.DOCUMENT,
      url: 'https://example.com/integration-resource',
    },
  });
  const task = await prisma.task.create({
    data: {
      description: 'Terminer la tâche de test.',
      key: `task-${key}`,
      isRequired: true,
      lessonId: lesson.id,
      position: 1,
      title: 'Tâche intégration',
      type: TaskType.CHECKLIST,
      weight: 1,
    },
  });
  const concept = await prisma.concept.create({
    data: {
      description: 'Notion obligatoire de test.',
      isRequired: true,
      lessonId: lesson.id,
      masteryThreshold: 70,
      position: 1,
      slug: `concept-${key}`,
      title: 'Notion intégration',
    },
  });
  await prisma.conceptResource.create({
    data: { conceptId: concept.id, resourceId: resource.id },
  });
  const conceptAssessment = await prisma.conceptAssessment.create({
    data: {
      assessmentType: ConceptAssessmentType.QUIZ,
      conceptId: concept.id,
      key: 'concept-integration-assessment-1',
      lessonId: lesson.id,
      isRequired: true,
      position: 1,
      questionCount: 1,
      title: 'Mini-évaluation intégration',
    },
  });
  const conceptQuestion = await prisma.conceptAssessmentQuestion.create({
    data: {
      assessmentId: conceptAssessment.id,
      explanation: 'La réponse correcte est vérifiée côté serveur.',
      position: 1,
      prompt: 'Quelle réponse valide la notion ?',
      type: ConceptQuestionType.SINGLE_CHOICE,
    },
  });
  const conceptCorrectOption = await prisma.conceptAssessmentOption.create({
    data: {
      isCorrect: true,
      label: 'La réponse fondée sur les données',
      position: 1,
      questionId: conceptQuestion.id,
    },
  });
  const conceptWrongOption = await prisma.conceptAssessmentOption.create({
    data: {
      isCorrect: false,
      label: 'La réponse intuitive',
      position: 2,
      questionId: conceptQuestion.id,
    },
  });
  const quiz = await prisma.quiz.create({
    data: {
      description: 'Quiz de synthèse réel.',
      isRequired: true,
      key: 'quiz-1',
      lessonId: lesson.id,
      passingScore: 70,
      position: 1,
      title: 'Quiz intégration',
    },
  });
  const quizQuestion = await prisma.question.create({
    data: {
      explanation: 'Une progression est confirmée par le serveur.',
      position: 1,
      prompt: 'Où la progression est-elle calculée ?',
      quizId: quiz.id,
      type: QuizQuestionType.SINGLE_CHOICE,
    },
  });
  const quizCorrectOption = await prisma.questionOption.create({
    data: {
      isCorrect: true,
      label: 'Côté serveur',
      position: 1,
      questionId: quizQuestion.id,
    },
  });
  await prisma.questionOption.create({
    data: {
      isCorrect: false,
      label: 'Uniquement dans le navigateur',
      position: 2,
      questionId: quizQuestion.id,
    },
  });
  const exercise = await prisma.exercise.create({
    data: {
      activityType: TaskType.PRACTICE,
      instructions: 'Rédiger une réponse courte.',
      isRequired: true,
      key: `exercise-${key}`,
      lessonId: lesson.id,
      position: 1,
      rubric: { expected: 'Une réponse argumentée.' },
      title: 'Exercice intégration',
    },
  });
  const stageAssessment = await prisma.stageAssessment.create({
    data: {
      description: 'Évaluation finale de la fixture.',
      instructions: 'Produire une courte synthèse.',
      isRequired: true,
      passingScore: 70,
      position: 1,
      rubric: { clarity: 100 },
      stageId: stage.id,
      title: 'Évaluation finale intégration',
      type: StageAssessmentType.WRITTEN_ASSIGNMENT,
    },
  });

  await prisma.lessonSequenceItem.createMany({
    data: [
      {
        contentBlockId: contentBlock.id,
        key: contentBlock.key,
        kind: LessonSequenceKind.CONTENT,
        lessonId: lesson.id,
        position: 1,
      },
      {
        key: resource.key,
        kind: LessonSequenceKind.RESOURCE,
        lessonId: lesson.id,
        position: 2,
        resourceId: resource.id,
      },
      {
        key: task.key,
        kind: LessonSequenceKind.TASK,
        lessonId: lesson.id,
        position: 3,
        taskId: task.id,
      },
      {
        conceptAssessmentId: conceptAssessment.id,
        key: conceptAssessment.key,
        kind: LessonSequenceKind.CONCEPT_ASSESSMENT,
        lessonId: lesson.id,
        position: 4,
      },
      {
        exerciseId: exercise.id,
        key: exercise.key,
        kind: LessonSequenceKind.EXERCISE,
        lessonId: lesson.id,
        position: 5,
      },
      {
        key: quiz.key,
        kind: LessonSequenceKind.QUIZ,
        lessonId: lesson.id,
        position: 6,
        quizId: quiz.id,
      },
    ],
  });

  return {
    conceptAssessmentId: conceptAssessment.id,
    conceptCorrectOptionId: conceptCorrectOption.id,
    conceptWrongOptionId: conceptWrongOption.id,
    conceptQuestionId: conceptQuestion.id,
    exerciseId: exercise.id,
    lessonId: lesson.id,
    lessonSlug,
    moduleSlug,
    moduleId: module.id,
    ownerEmail,
    programId: program.id,
    programSlug,
    quizCorrectOptionId: quizCorrectOption.id,
    quizId: quiz.id,
    quizQuestionId: quizQuestion.id,
    resourceId: resource.id,
    stageAssessmentId: stageAssessment.id,
    stageId: stage.id,
    stageSlug,
    taskId: task.id,
  };
}

export async function cleanupIntegrationUsers(emails: string[]): Promise<void> {
  requireEphemeralIntegrationDatabase();
  const { prisma } = await import('../../src/server/prisma.js');
  await prisma.program.deleteMany({
    where: { owner: { email: { in: emails } } },
  });
  await prisma.auditEvent.deleteMany({
    where: { actor: { email: { in: emails } } },
  });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
}
