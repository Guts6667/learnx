import type {
  CreateNoteInput,
  NoteRecord,
  NotesRepository,
  UpdateNoteInput,
} from './types.js';
import { noteNotFound } from './validation.js';

function serializeNote(note: NoteRecord) {
  return {
    ...note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

export function createNotesService(repository: NotesRepository) {
  return {
    async create(
      input: Omit<
        CreateNoteInput,
        'includeOwnerPreview' | 'lessonId' | 'programId' | 'userId'
      > & { lessonId?: string | null },
      userId: string,
    ) {
      const lesson = input.lessonId
        ? await repository.findLessonForUser(input.lessonId, userId, true)
        : null;
      if (input.lessonId && !lesson) throw noteNotFound();
      const note = await repository.create({
        ...input,
        includeOwnerPreview: true,
        lessonId: lesson?.id ?? null,
        programId: lesson?.programId ?? null,
        userId,
      });
      return serializeNote(note);
    },
    async delete(noteId: string, userId: string) {
      if (!await repository.deleteOwned(noteId, userId)) throw noteNotFound();
    },
    async list(
      input: Parameters<NotesRepository['list']>[0],
    ) {
      const page = await repository.list(input);
      return {
        nextCursor: page.nextCursor,
        notes: page.items.map(serializeNote),
      };
    },
    async read(noteId: string, userId: string) {
      const note = await repository.findOwned(noteId, userId);
      if (!note) throw noteNotFound();
      return serializeNote(note);
    },
    async update(input: UpdateNoteInput, userId: string) {
      if (!await repository.findOwned(input.id, userId)) throw noteNotFound();
      return serializeNote(await repository.update(input));
    },
  };
}
