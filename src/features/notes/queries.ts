import { QueryObserver } from '@tanstack/query-core';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';

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
  title: string;
  updatedAt: string;
}

interface NotesResponse {
  notes: NoteDetail[];
}

interface NoteResponse {
  note: NoteDetail;
}

function getNotesPath(search: string, lessonId?: string): string {
  const parameters = new URLSearchParams();

  if (search.trim()) parameters.set('search', search.trim());
  if (lessonId) parameters.set('lessonId', lessonId);

  const query = parameters.toString();

  return query ? `/api/notes?${query}` : '/api/notes';
}

export function useNotesQuery(search: string, lessonId?: string) {
  const queryClient = useAppQueryClient();
  const path = getNotesPath(search, lessonId);
  const observer = useMemo(
    () =>
      new QueryObserver<NotesResponse>(queryClient, {
        queryKey: ['notes', search, lessonId ?? ''],
        queryFn: () => apiRequest<NotesResponse>(path),
        staleTime: 0,
      }),
    [lessonId, path, queryClient, search],
  );
  const [result, setResult] = useState(() => observer.getCurrentResult());

  useEffect(() => {
    setResult(observer.getCurrentResult());
    const unsubscribe = observer.subscribe(setResult);
    void observer.refetch();
    return unsubscribe;
  }, [observer]);

  return {
    data: result.data,
    error: result.error,
    isPending: result.isPending,
  };
}

export function useNoteQuery(noteId: string) {
  const queryClient = useAppQueryClient();
  const observer = useMemo(
    () =>
      new QueryObserver<NoteResponse>(queryClient, {
        queryKey: ['note', noteId],
        queryFn: () =>
          apiRequest<NoteResponse>(`/api/notes/${encodeURIComponent(noteId)}`),
        staleTime: 0,
      }),
    [noteId, queryClient],
  );
  const [result, setResult] = useState(() => observer.getCurrentResult());

  useEffect(() => {
    setResult(observer.getCurrentResult());
    const unsubscribe = observer.subscribe(setResult);
    void observer.refetch();
    return unsubscribe;
  }, [observer]);

  return {
    data: result.data,
    error: result.error,
    isPending: result.isPending,
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
    (input: { lessonId?: string; markdown?: string; title?: string } = {}) =>
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

  return { create, error, isPending, save };
}
