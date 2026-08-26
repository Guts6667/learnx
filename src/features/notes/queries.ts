import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { useAppQueryClient } from '@/app/providers';
import { apiRequest } from '@/lib/api-client';

export interface NoteContext {
  id: string;
  slug: string;
  title: string;
}

export interface NoteDetail {
  createdAt: string;
  id: string;
  lesson: NoteContext | null;
  markdown: string;
  program: NoteContext | null;
  sequenceItem: {
    id: string;
    key: string;
    kind: string;
  } | null;
  title: string;
  updatedAt: string;
}

interface NotesResponse {
  nextCursor: string | null;
  notes: NoteDetail[];
}

interface NoteResponse {
  note: NoteDetail;
}

function getNotesPath(
  search: string,
  lessonId?: string,
  cursor?: string,
): string {
  const parameters = new URLSearchParams();

  if (search.trim()) parameters.set('search', search.trim());
  if (lessonId) parameters.set('lessonId', lessonId);
  if (cursor) parameters.set('cursor', cursor);

  const query = parameters.toString();

  return query ? `/api/notes?${query}` : '/api/notes';
}

export function useNotesQuery(search: string, lessonId?: string) {
  const path = getNotesPath(search, lessonId);
  const result = useQuery({
    queryKey: ['notes', search, lessonId ?? ''],
    queryFn: () => apiRequest<NotesResponse>(path),
    staleTime: 0,
  });
  const [notes, setNotes] = useState<NoteDetail[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    if (!result.data) return;
    setNotes(result.data.notes);
    setNextCursor(result.data.nextCursor);
  }, [result.data]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await apiRequest<NotesResponse>(
        getNotesPath(search, lessonId, nextCursor),
      );
      setNotes((current) => [
        ...current,
        ...page.notes.filter(
          (note) => !current.some((existing) => existing.id === note.id),
        ),
      ]);
      setNextCursor(page.nextCursor);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, lessonId, nextCursor, search]);

  return {
    data: result.data ? { ...result.data, nextCursor, notes } : undefined,
    error: result.error,
    hasMore: Boolean(nextCursor),
    isPending: result.isPending,
    isLoadingMore,
    loadMore,
    refetch: result.refetch,
  };
}

export function useNoteQuery(noteId: string) {
  const result = useQuery({
    queryKey: ['note', noteId],
    queryFn: () =>
      apiRequest<NoteResponse>(`/api/notes/${encodeURIComponent(noteId)}`),
    staleTime: 0,
  });

  return {
    data: result.data,
    error: result.error,
    isPending: result.isPending,
    refetch: result.refetch,
  };
}

export function useNoteMutation() {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);
  const execute = useCallback(
    async (request: () => Promise<NoteResponse>) => {
      setError(undefined);
      setIsPending(true);

      try {
        const response = await request();
        queryClient.setQueryData<NoteResponse>(
          ['note', response.note.id],
          response,
        );
        await queryClient.invalidateQueries({ queryKey: ['notes'] });
        return response.note;
      } catch (requestError) {
        setError(requestError);
        throw requestError;
      } finally {
        setIsPending(false);
      }
    },
    [queryClient],
  );
  const create = useCallback(
    (
      input: {
        creationKey?: string;
        lessonId?: string;
        markdown?: string;
        sequenceItemId?: string;
        title?: string;
      } = {},
    ) =>
      execute(() =>
        apiRequest<NoteResponse>('/api/notes', {
          body: JSON.stringify(input),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        }),
      ),
    [execute],
  );
  const save = useCallback(
    (noteId: string, input: { markdown: string; title: string }) =>
      execute(() =>
        apiRequest<NoteResponse>(`/api/notes/${encodeURIComponent(noteId)}`, {
          body: JSON.stringify(input),
          headers: { 'content-type': 'application/json' },
          method: 'PATCH',
        }),
      ),
    [execute],
  );
  const remove = useCallback(
    async (noteId: string) => {
      setError(undefined);
      setIsPending(true);

      try {
        await apiRequest<undefined>(
          `/api/notes/${encodeURIComponent(noteId)}`,
          { method: 'DELETE' },
        );
        queryClient.removeQueries({ queryKey: ['note', noteId] });
        await queryClient.invalidateQueries({ queryKey: ['notes'] });
      } catch (requestError) {
        setError(requestError);
        throw requestError;
      } finally {
        setIsPending(false);
      }
    },
    [queryClient],
  );

  return { create, error, isPending, remove, save };
}
