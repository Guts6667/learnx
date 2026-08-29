import { AuditAction } from '../../../../generated/prisma/client.js';
import { createAuditIdempotencyKey } from '../_lib/audit.js';
import type {
  AdminLesson,
  AdminModule,
  AdminRepository,
  LessonPublicationState,
  LessonUpdate,
  ModuleUpdate,
  CurriculumEditResult,
  CurriculumEditService,
} from './curriculum-edit-types.js';

export type { CurriculumEditService } from './curriculum-edit-types.js';

function isReadyForPublication(lesson: LessonPublicationState) {
  return lesson.concepts.every((concept) => concept.assessments.length > 0);
}

async function updateLesson(
  repository: AdminRepository,
  ownerId: string,
  lessonId: string,
  input: LessonUpdate,
): Promise<CurriculumEditResult<AdminLesson>> {
  const lesson = await repository.findLessonForOwner(lessonId, ownerId);
  if (!lesson) return { kind: 'NOT_FOUND' };
  if (input.isPublished && !isReadyForPublication(lesson)) {
    return { kind: 'LESSON_NOT_READY' };
  }
  const updated = await repository.updateLesson(lessonId, input, {
    actorUserId: ownerId,
    idempotencyKey: createAuditIdempotencyKey(
      AuditAction.LESSON_UPDATE,
      lessonId,
      { ...input },
    ),
  });
  return updated ? { kind: 'APPLIED', value: updated } : { kind: 'NOT_FOUND' };
}

async function updateModule(
  repository: AdminRepository,
  ownerId: string,
  moduleId: string,
  input: ModuleUpdate,
): Promise<CurriculumEditResult<AdminModule>> {
  const module = await repository.findModuleForOwner(moduleId, ownerId);
  if (!module) return { kind: 'NOT_FOUND' };
  const updated = await repository.updateModule(moduleId, input, {
    actorUserId: ownerId,
    idempotencyKey: createAuditIdempotencyKey(
      AuditAction.MODULE_UPDATE,
      moduleId,
      { ...input },
    ),
  });
  return updated ? { kind: 'APPLIED', value: updated } : { kind: 'NOT_FOUND' };
}

export function createCurriculumEditService(
  repository: AdminRepository,
): CurriculumEditService {
  return {
    updateLesson: (ownerId, lessonId, input) =>
      updateLesson(repository, ownerId, lessonId, input),
    updateModule: (ownerId, moduleId, input) =>
      updateModule(repository, ownerId, moduleId, input),
  };
}
