import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

import { apiRequest } from '@/lib/api-client';

export interface CatalogProgram {
  description: string;
  estimatedDurationDays: number | null;
  icon: string | null;
  id: string;
  isEnrolled: boolean;
  publishedVersion: {
    checksum: string;
    id: string;
    number: number;
    publishedAt: string;
  };
  slug: string;
  stageCount: number;
  title: string;
}

export type EnrollmentStatus = 'ACTIVE' | 'WITHDRAWN';

export interface EnrolledProgram {
  enrollment: {
    enrolledAt: string;
    id: string;
    status: EnrollmentStatus;
    updatedAt: string;
    withdrawnAt: string | null;
  };
  program: {
    description: string;
    estimatedDurationDays: number | null;
    icon: string | null;
    id: string;
    publishedVersion: {
      checksum: string;
      id: string;
      number: number;
      publishedAt: string;
    };
    slug: string;
    title: string;
  };
  progress: {
    completedAt: string | null;
    lastViewedAt: string;
    percent: number;
    startedAt: string | null;
    targetEndAt: string | null;
  } | null;
}

interface DirectoryPage<T> {
  items: T[];
  nextCursor: string | null;
}

function appendUnique<T>(
  current: T[],
  next: T[],
  getIdentifier: (item: T) => string,
) {
  const identifiers = new Set(current.map(getIdentifier));
  return [
    ...current,
    ...next.filter((item) => !identifiers.has(getIdentifier(item))),
  ];
}

function useDirectoryPage<T>(
  path: string,
  enabled: boolean,
  getIdentifier: (item: T) => string,
) {
  const requestSequence = useRef(0);
  const [data, setData] = useState<DirectoryPage<T>>({
    items: [],
    nextCursor: null,
  });
  const [error, setError] = useState<unknown>();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isPending, setIsPending] = useState(enabled);

  const load = useCallback(
    async (cursor?: string) => {
      if (!enabled) return;
      const sequence = requestSequence.current + 1;
      requestSequence.current = sequence;
      const loadingMore = Boolean(cursor);
      setError(undefined);
      setIsLoadingMore(loadingMore);
      setIsPending(!loadingMore);
      try {
        const searchParams = new URLSearchParams();
        if (cursor) searchParams.set('cursor', cursor);
        const separator = path.includes('?') ? '&' : '?';
        const response = await apiRequest<DirectoryPage<T>>(
          `${path}${searchParams.size > 0 ? `${separator}${searchParams}` : ''}`,
        );
        if (requestSequence.current !== sequence) return;
        setData((current) => ({
          items: cursor
            ? appendUnique(current.items, response.items, getIdentifier)
            : response.items,
          nextCursor: response.nextCursor,
        }));
      } catch (requestError) {
        if (requestSequence.current === sequence) setError(requestError);
      } finally {
        if (requestSequence.current === sequence) {
          setIsLoadingMore(false);
          setIsPending(false);
        }
      }
    },
    [enabled, getIdentifier, path],
  );

  useEffect(() => {
    if (!enabled) {
      requestSequence.current += 1;
      setIsLoadingMore(false);
      setIsPending(false);
      return;
    }
    void load();
  }, [enabled, load]);

  const loadMore = useCallback(async () => {
    if (data.nextCursor) await load(data.nextCursor);
  }, [data.nextCursor, load]);
  const reload = useCallback(async () => load(), [load]);

  return {
    data,
    error,
    isLoadingMore,
    isPending,
    loadMore,
    reload,
  };
}

function programDirectoryPath(
  basePath: string,
  search: string,
  status?: EnrollmentStatus,
) {
  const searchParams = new URLSearchParams({ pageSize: '12' });
  if (search) searchParams.set('search', search);
  if (status) searchParams.set('status', status);
  return `${basePath}?${searchParams}`;
}

function catalogProgramIdentifier(program: CatalogProgram) {
  return program.id;
}

function enrolledProgramIdentifier(program: EnrolledProgram) {
  return program.enrollment.id;
}

export function useCatalogProgramsQuery(search: string, enabled = true) {
  return useDirectoryPage<CatalogProgram>(
    programDirectoryPath('/api/catalog/programs', search),
    enabled,
    catalogProgramIdentifier,
  );
}

export function useEnrolledProgramsQuery(
  search: string,
  status: EnrollmentStatus,
  enabled = true,
) {
  return useDirectoryPage<EnrolledProgram>(
    programDirectoryPath('/api/me/programs', search, status),
    enabled,
    enrolledProgramIdentifier,
  );
}

export function useProgramEnrollmentMutation() {
  const [error, setError] = useState<unknown>();
  const [pendingProgramId, setPendingProgramId] = useState<string>();

  const execute = useCallback(
    async (programId: string, action: 'enroll' | 'withdraw') => {
      setError(undefined);
      setPendingProgramId(programId);
      try {
        return await apiRequest(
          `/api/programs/${encodeURIComponent(programId)}/enrollment`,
          { method: action === 'enroll' ? 'POST' : 'DELETE' },
        );
      } catch (requestError) {
        setError(requestError);
        throw requestError;
      } finally {
        setPendingProgramId(undefined);
      }
    },
    [],
  );

  return { error, execute, pendingProgramId };
}
