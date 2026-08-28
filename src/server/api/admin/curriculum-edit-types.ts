export interface AdminLesson {
  id: string;
  isPublished: boolean;
  position: number;
  slug: string;
  summary: string;
  title: string;
}

export interface AdminModule {
  description: string;
  id: string;
  isPublished: boolean;
  lessons: AdminLesson[];
  position: number;
  slug: string;
  title: string;
}

export interface LessonPublicationState {
  concepts: Array<{ assessments: Array<{ id: string }> }>;
  id: string;
}

export interface ModulePublicationState {
  id: string;
  lessons: LessonPublicationState[];
}

export interface ModuleUpdate {
  description?: string;
  position?: number;
  title?: string;
}

export interface LessonUpdate {
  isPublished?: boolean;
  position?: number;
  summary?: string;
  title?: string;
}

export interface CurriculumAudit {
  actorUserId: string;
  idempotencyKey: string;
}

export interface AdminRepository {
  findLessonForOwner(
    lessonId: string,
    ownerId: string,
  ): Promise<LessonPublicationState | null>;
  findModuleForOwner(
    moduleId: string,
    ownerId: string,
  ): Promise<ModulePublicationState | null>;
  updateLesson(
    lessonId: string,
    input: LessonUpdate,
    audit: CurriculumAudit,
  ): Promise<AdminLesson | null>;
  updateModule(
    moduleId: string,
    input: ModuleUpdate,
    audit: CurriculumAudit,
  ): Promise<AdminModule | null>;
}

export type CurriculumEditResult<T> =
  | { kind: 'APPLIED'; value: T }
  | { kind: 'LESSON_NOT_READY' }
  | { kind: 'NOT_FOUND' };

export interface CurriculumEditService {
  updateLesson(
    ownerId: string,
    lessonId: string,
    input: LessonUpdate,
  ): Promise<CurriculumEditResult<AdminLesson>>;
  updateModule(
    ownerId: string,
    moduleId: string,
    input: ModuleUpdate,
  ): Promise<CurriculumEditResult<AdminModule>>;
}
