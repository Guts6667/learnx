import { QueryClient } from '@tanstack/query-core';

import {
  replacePrivateSessionCache,
  type SessionResponse,
} from '@/features/auth/session';

const authenticatedSession: SessionResponse = {
  user: {
    displayName: 'Nouvel utilisateur',
    email: 'new@example.com',
    id: 'user-new',
    locale: 'fr',
    role: 'USER',
  },
};

describe('private session cache isolation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('purge les données privées en mémoire et navigateur au changement de compte', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['session'], {
      user: { id: 'user-old' },
    });
    queryClient.setQueryData(['notes'], { notes: [{ id: 'private-note' }] });
    queryClient.setQueryData(['lesson-progress', 'lesson-1'], { percent: 80 });
    window.localStorage.setItem(
      'learnx:lesson-activity:lesson-1',
      'exercise:exercise-1',
    );
    window.sessionStorage.setItem('learnx:private-draft', 'secret');
    window.localStorage.setItem('unrelated-preference', 'kept');

    replacePrivateSessionCache(queryClient, authenticatedSession);

    expect(queryClient.getQueryData(['notes'])).toBeUndefined();
    expect(
      queryClient.getQueryData(['lesson-progress', 'lesson-1']),
    ).toBeUndefined();
    expect(queryClient.getQueryData(['session'])).toEqual(
      authenticatedSession,
    );
    expect(
      window.localStorage.getItem('learnx:lesson-activity:lesson-1'),
    ).toBeNull();
    expect(window.sessionStorage.getItem('learnx:private-draft')).toBeNull();
    expect(window.localStorage.getItem('unrelated-preference')).toBe('kept');
  });

  it('purge les mêmes données après une déconnexion confirmée', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['quiz-attempts', 'quiz-1'], {
      attempts: [{ id: 'attempt-1' }],
    });
    window.localStorage.setItem('learnx:lesson-activity:lesson-1', 'quiz:quiz-1');

    replacePrivateSessionCache(queryClient, { user: null });

    expect(queryClient.getQueryData(['quiz-attempts', 'quiz-1'])).toBeUndefined();
    expect(queryClient.getQueryData(['session'])).toEqual({ user: null });
    expect(window.localStorage.length).toBe(0);
  });
});
