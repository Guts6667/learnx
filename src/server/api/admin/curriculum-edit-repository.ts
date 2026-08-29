import {
  AuditAction,
  type Prisma,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import { writeAuditEvent } from '../_lib/audit.js';
import { editorialProgramWhere } from '../_lib/program-access-policy.js';
import type {
  AdminLesson,
  AdminModule,
  AdminRepository,
  CurriculumAudit,
  LessonUpdate,
  ModuleUpdate,
} from './curriculum-edit-types.js';

const lessonSelect = {
  id: true,
  isPublished: true,
  position: true,
  slug: true,
  summary: true,
  title: true,
} as const;

const moduleSelect = {
  description: true,
  id: true,
  isPublished: true,
  lessons: {
    orderBy: { position: 'asc' as const },
    select: lessonSelect,
  },
  position: true,
  slug: true,
  title: true,
} as const;

async function findLessonForOwner(
  client: PrismaClient,
  lessonId: string,
  ownerId: string,
) {
  return client.lesson.findFirst({
    where: {
      id: lessonId,
      module: { stage: { program: editorialProgramWhere(ownerId) } },
    },
    select: {
      id: true,
      concepts: {
        where: { isRequired: true },
        select: {
          assessments: {
            where: { isRequired: true },
            select: { id: true },
          },
        },
      },
    },
  });
}

async function findModuleForOwner(
  client: PrismaClient,
  moduleId: string,
  ownerId: string,
) {
  return client.module.findFirst({
    where: {
      id: moduleId,
      stage: { program: editorialProgramWhere(ownerId) },
    },
    select: {
      id: true,
      lessons: {
        where: { isPublished: true },
        select: {
          concepts: {
            where: { isRequired: true },
            select: {
              assessments: {
                where: { isRequired: true },
                select: { id: true },
              },
            },
          },
          id: true,
        },
      },
    },
  });
}

async function findOwnedLesson(
  transaction: Prisma.TransactionClient,
  lessonId: string,
  ownerId: string,
) {
  return transaction.lesson.findFirst({
    select: { id: true },
    where: {
      id: lessonId,
      module: { stage: { program: editorialProgramWhere(ownerId) } },
    },
  });
}

async function updateLesson(
  client: PrismaClient,
  lessonId: string,
  input: LessonUpdate,
  audit: CurriculumAudit,
): Promise<AdminLesson | null> {
  return client.$transaction(async (transaction) => {
    const owned = await findOwnedLesson(
      transaction,
      lessonId,
      audit.actorUserId,
    );
    if (!owned) return null;
    const lesson = await transaction.lesson.update({
      data: input,
      select: lessonSelect,
      where: { id: lessonId },
    });
    await writeCurriculumAudit(
      transaction,
      AuditAction.LESSON_UPDATE,
      lessonId,
      input,
      audit,
    );
    return lesson;
  });
}

async function findOwnedModule(
  transaction: Prisma.TransactionClient,
  moduleId: string,
  ownerId: string,
) {
  return transaction.module.findFirst({
    select: { id: true },
    where: {
      id: moduleId,
      stage: { program: editorialProgramWhere(ownerId) },
    },
  });
}

async function updateModule(
  client: PrismaClient,
  moduleId: string,
  input: ModuleUpdate,
  audit: CurriculumAudit,
): Promise<AdminModule | null> {
  return client.$transaction(async (transaction) => {
    const owned = await findOwnedModule(
      transaction,
      moduleId,
      audit.actorUserId,
    );
    if (!owned) return null;
    const module = await transaction.module.update({
      data: input,
      select: moduleSelect,
      where: { id: moduleId },
    });
    await writeCurriculumAudit(
      transaction,
      AuditAction.MODULE_UPDATE,
      moduleId,
      input,
      audit,
    );
    return module;
  });
}

async function writeCurriculumAudit(
  transaction: Prisma.TransactionClient,
  action: typeof AuditAction.LESSON_UPDATE | typeof AuditAction.MODULE_UPDATE,
  targetId: string,
  input: LessonUpdate | ModuleUpdate,
  audit: CurriculumAudit,
) {
  await writeAuditEvent(transaction, {
    action,
    actorUserId: audit.actorUserId,
    idempotencyKey: audit.idempotencyKey,
    metadata: { changedFields: Object.keys(input).sort() },
    targetId,
    targetType: action === AuditAction.LESSON_UPDATE ? 'lesson' : 'module',
  });
}

export function createPrismaAdminRepository(
  client: PrismaClient,
): AdminRepository {
  return {
    findLessonForOwner: (lessonId, ownerId) =>
      findLessonForOwner(client, lessonId, ownerId),
    findModuleForOwner: (moduleId, ownerId) =>
      findModuleForOwner(client, moduleId, ownerId),
    updateLesson: (lessonId, input, audit) =>
      updateLesson(client, lessonId, input, audit),
    updateModule: (moduleId, input, audit) =>
      updateModule(client, moduleId, input, audit),
  };
}
