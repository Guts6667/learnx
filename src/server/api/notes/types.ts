import type { MiddlewareHandler } from 'hono';

import type { AuthEnvironment } from '../_lib/auth.js';
import type { CursorPage } from '../_lib/cursor-pagination.js';

interface NoteContext {
  id: string;
  slug: string;
  title: string;
}

interface NoteActivityContext {
  id: string;
  key: string;
  kind: string;
}

export interface NoteRecord {
  createdAt: Date;
  id: string;
  lesson: NoteContext | null;
  markdown: string;
  program: NoteContext | null;
  sequenceItem: NoteActivityContext | null;
  title: string;
  updatedAt: Date;
}

export interface CreateNoteInput {
  creationKey: string | null;
  includeOwnerPreview?: boolean;
  lessonId: string | null;
  markdown: string;
  programId: string | null;
  sequenceItemId: string | null;
  title: string;
  userId: string;
}

export interface UpdateNoteInput {
  id: string;
  markdown?: string;
  title?: string;
}

export interface NotesRepository {
  create(input: CreateNoteInput): Promise<NoteRecord>;
  deleteOwned(noteId: string, userId: string): Promise<boolean>;
  findLessonForUser(
    lessonId: string,
    userId: string,
    canPreview: boolean,
  ): Promise<{ id: string; programId: string } | null>;
  findOwned(noteId: string, userId: string): Promise<NoteRecord | null>;
  list(input: {
    cursor?: string;
    lessonId?: string;
    pageSize: number;
    search?: string;
    userId: string;
  }): Promise<CursorPage<NoteRecord>>;
  update(input: UpdateNoteInput): Promise<NoteRecord>;
}

export interface NotesAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  repository?: NotesRepository;
}
