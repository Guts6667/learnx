import type { NoteRecord } from './types.js';

export function serializeNote(note: NoteRecord) {
  return {
    ...note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}
