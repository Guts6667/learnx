import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

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
  const result = useInfiniteQuery({
    queryKey: ['notes', search, lessonId ?? ''],
    queryFn: ({ pageParam }) =>
      apiRequest<NotesResponse>(
        getNotesPath(search, lessonId, pageParam ?? undefined),
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    initialPageParam: null as string | null,
    staleTime: 0,
  });
  const notes = useMemo(() => {
    const uniqueNotes = new Map<string, NoteDetail>();
    for (const page of result.data?.pages ?? []) {
      for (const note of page.notes) uniqueNotes.set(note.id, note);
    }
    return [...uniqueNotes.values()];
  }, [result.data?.pages]);
  const loadMore = useCallback(async () => {
    if (!result.hasNextPage || result.isFetchingNextPage) return;
    try {
      await result.fetchNextPage();
    } catch {
      // React Query conserve les pages déjà chargées et expose l'erreur.
    }
  }, [result.fetchNextPage, result.hasNextPage, result.isFetchingNextPage]);
  const lastPage = result.data?.pages.at(-1);

  return {
    data: result.data
      ? { nextCursor: lastPage?.nextCursor ?? null, notes }
      : undefined,
    error: result.data ? null : result.error,
    hasMore: result.hasNextPage,
    isPending: result.isPending,
    isLoadingMore: result.isFetchingNextPage,
    loadMore,
    loadMoreError:
      result.data && result.isFetchNextPageError ? result.error : null,
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
