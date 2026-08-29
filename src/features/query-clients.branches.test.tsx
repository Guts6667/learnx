import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { AppQueryProvider } from '@/app/query-provider';
import {
  useAdminCurriculumMutation,
  useAdminNavigationQuery,
  type AdminNavigationTarget,
} from '@/features/admin/queries';
import {
  useExerciseMutation,
  useExerciseQuery,
  type ExerciseDetail,
  type ExerciseSubmission,
} from '@/features/exercises/queries';
import {
  useNoteMutation,
  useNoteQuery,
  useNotesQuery,
  type NoteDetail,
} from '@/features/notes/queries';
import {
  useCatalogProgramsQuery,
  useEnrolledProgramsQuery,
  useProgramEnrollmentMutation,
  type CatalogProgram,
  type EnrolledProgram,
} from '@/features/programs/queries';

const apiRequest = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({ apiRequest }));

function QueryWrapper({ children }: { children: ReactNode }) {
  return <AppQueryProvider>{children}</AppQueryProvider>;
}

const catalogProgram: CatalogProgram = {
  canonicalProgramKey: 'program-one',
  description: 'Description',
  estimatedDurationDays: 5,
  icon: null,
  id: 'program/1',
  isEnrolled: false,
  locale: 'fr',
  publishedVersion: {
    checksum: 'checksum',
    id: 'version-1',
    number: 1,
    publishedAt: '2026-08-28T10:00:00Z',
  },
  slug: 'program-one',
  stageCount: 2,
  title: 'Programme un',
};

const enrolledProgram: EnrolledProgram = {
  enrollment: {
    enrolledAt: '2026-08-28T10:00:00Z',
    id: 'enrollment-1',
    status: 'ACTIVE',
    updatedAt: '2026-08-28T10:00:00Z',
    withdrawnAt: null,
  },
  program: {
    ...catalogProgram,
    publishedVersion: catalogProgram.publishedVersion,
  },
  progress: null,
};

const note: NoteDetail = {
  createdAt: '2026-08-28T10:00:00Z',
  id: 'note/1',
  lesson: null,
  markdown: 'Contenu',
  program: null,
  sequenceItem: null,
  title: 'Note une',
  updatedAt: '2026-08-28T10:00:00Z',
};

const submission: ExerciseSubmission = {
  contentMarkdown: 'Réponse',
  createdAt: '2026-08-28T10:00:00Z',
  exerciseId: 'exercise/1',
  id: 'submission/1',
  status: 'DRAFT',
  submittedAt: null,
  updatedAt: '2026-08-28T10:00:00Z',
  userId: 'user-1',
};

const exercise: ExerciseDetail = {
  aiCorrectionEligible: true,
  id: 'exercise/1',
  instructions: 'Répondez.',
  isRequired: true,
  lessonId: 'lesson-1',
  position: 1,
  rubric: null,
  submission: null,
  title: 'Exercice',
};

describe('program query clients', () => {
  beforeEach(() => apiRequest.mockReset());

  it('charge, pagine et déduplique le catalogue public', async () => {
    apiRequest
      .mockResolvedValueOnce({
        items: [catalogProgram],
        nextCursor: 'page/2',
      })
      .mockResolvedValueOnce({
        items: [
          catalogProgram,
          { ...catalogProgram, id: 'program-2', title: 'Programme deux' },
        ],
        nextCursor: null,
      });
    const { result } = renderHook(
      () => useCatalogProgramsQuery('réseau local', 'fr'),
      { wrapper: QueryWrapper },
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(apiRequest).toHaveBeenNthCalledWith(
      1,
      '/api/catalog/programs?pageSize=12&search=r%C3%A9seau+local&locale=fr',
    );

    await act(() => result.current.loadMore());
    expect(apiRequest).toHaveBeenNthCalledWith(
      2,
      '/api/catalog/programs?pageSize=12&search=r%C3%A9seau+local&locale=fr&cursor=page%2F2',
    );
    expect(result.current.data.items.map((item) => item.id)).toEqual([
      'program/1',
      'program-2',
    ]);
    await act(() => result.current.loadMore());
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it('désactive une requête puis la recharge avec le filtre d’inscription', async () => {
    apiRequest.mockResolvedValue({
      items: [enrolledProgram],
      nextCursor: null,
    });
    const { rerender, result } = renderHook(
      ({ enabled }) => useEnrolledProgramsQuery('', 'ACTIVE', enabled),
      { initialProps: { enabled: false }, wrapper: QueryWrapper },
    );

    expect(result.current.isPending).toBe(false);
    expect(apiRequest).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.data.items).toHaveLength(1));
    expect(apiRequest).toHaveBeenCalledWith(
      '/api/me/programs?pageSize=12&status=ACTIVE',
    );

    await act(() => result.current.reload());
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it('expose l’erreur réseau et réinitialise les états de chargement', async () => {
    const requestError = new Error('catalog unavailable');
    apiRequest
      .mockRejectedValueOnce(requestError)
      .mockResolvedValue({ items: [], nextCursor: null });
    const { result } = renderHook(() => useCatalogProgramsQuery('', 'en'), {
      wrapper: QueryWrapper,
    });

    await waitFor(() => expect(result.current.error).toBe(requestError));
    expect(result.current.isPending).toBe(false);
    expect(result.current.isLoadingMore).toBe(false);
  });

  it('exécute les inscriptions et retraits, et conserve une erreur exploitable', async () => {
    apiRequest
      .mockResolvedValueOnce({ status: 'ACTIVE' })
      .mockResolvedValueOnce({ status: 'WITHDRAWN' })
      .mockRejectedValueOnce(new Error('enrollment unavailable'));
    const { result } = renderHook(() => useProgramEnrollmentMutation());

    await act(() => result.current.execute('program/1', 'enroll'));
    expect(apiRequest).toHaveBeenNthCalledWith(
      1,
      '/api/programs/program%2F1/enrollment',
      { method: 'POST' },
    );
    await act(() => result.current.execute('program/1', 'withdraw'));
    expect(apiRequest).toHaveBeenNthCalledWith(
      2,
      '/api/programs/program%2F1/enrollment',
      { method: 'DELETE' },
    );
    await act(async () => {
      await expect(
        result.current.execute('program/2', 'enroll'),
      ).rejects.toThrow('enrollment unavailable');
    });
    await waitFor(() =>
      expect(result.current.error).toEqual(new Error('enrollment unavailable')),
    );
    expect(result.current.pendingProgramId).toBeUndefined();
  });
});

describe('note query clients', () => {
  beforeEach(() => apiRequest.mockReset());

  it('construit les filtres, déduplique les pages et expose la fin de liste', async () => {
    apiRequest
      .mockResolvedValueOnce({ nextCursor: 'next/cursor', notes: [note] })
      .mockResolvedValueOnce({
        nextCursor: null,
        notes: [
          { ...note, title: 'Note mise à jour' },
          { ...note, id: 'note-2', title: 'Note deux' },
        ],
      });
    const { result } = renderHook(
      () => useNotesQuery('  docker local  ', 'lesson/1'),
      { wrapper: QueryWrapper },
    );

    await waitFor(() => expect(result.current.data?.notes).toHaveLength(1));
    expect(apiRequest).toHaveBeenNthCalledWith(
      1,
      '/api/notes?search=docker+local&lessonId=lesson%2F1',
    );
    await act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.data?.notes).toHaveLength(2));
    expect(apiRequest).toHaveBeenNthCalledWith(
      2,
      '/api/notes?search=docker+local&lessonId=lesson%2F1&cursor=next%2Fcursor',
    );
    expect(result.current.data?.notes[0]?.title).toBe('Note mise à jour');
    expect(result.current.hasMore).toBe(false);
    await act(() => result.current.loadMore());
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it('sépare erreur initiale et erreur de pagination', async () => {
    const firstError = new Error('notes unavailable');
    apiRequest.mockRejectedValueOnce(firstError);
    const initial = renderHook(() => useNotesQuery(''), {
      wrapper: QueryWrapper,
    });
    await waitFor(() => expect(initial.result.current.error).toBe(firstError));
    initial.unmount();

    const paginationError = new Error('next page unavailable');
    apiRequest
      .mockResolvedValueOnce({ nextCursor: 'next', notes: [note] })
      .mockRejectedValueOnce(paginationError);
    const paginated = renderHook(() => useNotesQuery(''), {
      wrapper: QueryWrapper,
    });
    await waitFor(() => expect(paginated.result.current.hasMore).toBe(true));
    await act(() => paginated.result.current.loadMore());
    await waitFor(() =>
      expect(paginated.result.current.loadMoreError).toBe(paginationError),
    );
    expect(paginated.result.current.data?.notes).toEqual([note]);
  });

  it('charge un détail et expose sa fonction de rafraîchissement', async () => {
    apiRequest.mockResolvedValue({ note });
    const { result } = renderHook(() => useNoteQuery('note/1'), {
      wrapper: QueryWrapper,
    });

    await waitFor(() => expect(result.current.data?.note).toEqual(note));
    expect(apiRequest).toHaveBeenCalledWith('/api/notes/note%2F1');
    await act(() => result.current.refetch());
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it('crée, sauvegarde et supprime une note avant de propager les erreurs', async () => {
    apiRequest
      .mockResolvedValueOnce({ note })
      .mockResolvedValueOnce({ note: { ...note, title: 'Modifiée' } })
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('save unavailable'))
      .mockRejectedValueOnce(new Error('delete unavailable'));
    const { result } = renderHook(() => useNoteMutation(), {
      wrapper: QueryWrapper,
    });

    await act(() => result.current.create());
    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/notes', {
      body: '{}',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    await act(() =>
      result.current.save('note/1', { markdown: 'M', title: 'T' }),
    );
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/notes/note%2F1', {
      body: JSON.stringify({ markdown: 'M', title: 'T' }),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH',
    });
    await act(() => result.current.remove('note/1'));
    await act(async () => {
      await expect(
        result.current.save('note/1', { markdown: 'M', title: 'T' }),
      ).rejects.toThrow('save unavailable');
    });
    await act(async () => {
      await expect(result.current.remove('note/1')).rejects.toThrow(
        'delete unavailable',
      );
    });
    expect(result.current.isPending).toBe(false);
    await waitFor(() =>
      expect(result.current.error).toEqual(new Error('delete unavailable')),
    );
  });
});

describe('exercise query clients', () => {
  beforeEach(() => apiRequest.mockReset());

  it('charge puis rafraîchit un exercice', async () => {
    apiRequest.mockResolvedValue({ exercise });
    const { result } = renderHook(() => useExerciseQuery('exercise/1'), {
      wrapper: QueryWrapper,
    });

    await waitFor(() =>
      expect(result.current.data?.exercise).toEqual(exercise),
    );
    expect(apiRequest).toHaveBeenCalledWith('/api/exercises/exercise%2F1');
    await act(() => result.current.reload());
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it('crée, sauvegarde et soumet une réponse avec les contrats HTTP attendus', async () => {
    apiRequest
      .mockResolvedValueOnce({ submission })
      .mockResolvedValueOnce({
        submission: { ...submission, contentMarkdown: 'Suite' },
      })
      .mockResolvedValueOnce({
        submission: { ...submission, status: 'SUBMITTED', submittedAt: 'now' },
      });
    const { result } = renderHook(() => useExerciseMutation('exercise/1'), {
      wrapper: QueryWrapper,
    });

    await act(() => result.current.createDraft());
    expect(apiRequest).toHaveBeenNthCalledWith(
      1,
      '/api/exercises/exercise%2F1/submissions',
      { method: 'POST' },
    );
    await act(() => result.current.save('submission/1', 'Suite'));
    await act(() => result.current.submit('submission/1'));
    expect(apiRequest).toHaveBeenNthCalledWith(
      3,
      '/api/exercise-submissions/submission%2F1/submit',
      { method: 'POST' },
    );
    expect(result.current.isPending).toBe(false);
  });
});

describe('admin query clients', () => {
  beforeEach(() => apiRequest.mockReset());

  it.each<[AdminNavigationTarget, string]>([
    [{ kind: 'PROGRAMS' }, '/api/admin/programs'],
    [{ id: 'program/1', kind: 'PROGRAM' }, '/api/admin/programs/program%2F1'],
    [{ id: 'stage/1', kind: 'STAGE' }, '/api/admin/stages/stage%2F1'],
    [{ id: 'module/1', kind: 'MODULE' }, '/api/admin/modules/module%2F1'],
    [{ id: 'lesson/1', kind: 'LESSON' }, '/api/admin/lessons/lesson%2F1'],
  ])('charge la cible de navigation %j', async (target, expectedPath) => {
    apiRequest.mockResolvedValue({ kind: target.kind });
    const { result } = renderHook(() => useAdminNavigationQuery(target), {
      wrapper: QueryWrapper,
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(apiRequest).toHaveBeenCalledWith(expectedPath);
    await act(() => result.current.retry());
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it('exécute les mises à jour et les deux phases de publication', async () => {
    const plan = { planId: 'plan-1' };
    apiRequest
      .mockResolvedValueOnce({ module: { id: 'module/1' } })
      .mockResolvedValueOnce({ lesson: { id: 'lesson/1' } })
      .mockResolvedValueOnce({ program: { id: 'program/1' } })
      .mockResolvedValueOnce({ plan })
      .mockResolvedValueOnce({ plan });
    const { result } = renderHook(() => useAdminCurriculumMutation(), {
      wrapper: QueryWrapper,
    });

    await act(() =>
      result.current.updateModule('module/1', { title: 'Module' }),
    );
    await act(() =>
      result.current.updateLesson('lesson/1', { title: 'Leçon' }),
    );
    await act(() =>
      result.current.updateProgramVisibility('program/1', {
        updatedAt: '2026-08-28T10:00:00Z',
        visibility: 'PUBLIC',
      }),
    );
    const request = {
      action: 'PUBLISH' as const,
      mode: 'FULL' as const,
      targetId: 'program/1',
      targetType: 'PROGRAM' as const,
    };
    await expect(
      act(() => result.current.previewPublication(request)),
    ).resolves.toEqual(plan);
    await expect(
      act(() =>
        result.current.applyPublication({ ...request, planId: 'plan-1' }),
      ),
    ).resolves.toEqual(plan);
    expect(apiRequest).toHaveBeenNthCalledWith(
      3,
      '/api/admin/programs/program%2F1/visibility',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      4,
      '/api/admin/publication/preview',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      5,
      '/api/admin/publication/apply',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
