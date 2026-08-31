import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AppProviders } from '@/app/providers';
import { PwaProvider } from '@/features/pwa/PwaStatus';
import { ProfilePage } from '@/pages/ProfilePage';

vi.mock('@/app/navigation', () => ({ navigate: vi.fn() }));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

function sessionUser(correctionReuseConsent: boolean) {
  return {
    user: {
      correctionReuseConsent,
      displayName: 'Rayan',
      email: 'rayan@example.test',
      id: 'user-1',
      locale: 'fr',
      role: 'USER',
    },
  };
}

/**
 * V4.5-168, seconde moitié : l'apprenant peut enfin dire oui ou non.
 *
 * Le schéma et la règle de détachement existaient déjà ; rien ne permettait de
 * donner le consentement qu'ils lisent, donc il valait faux partout et les
 * textes étaient supprimés à 180 jours par prudence.
 */
describe('ProfilePage — consentement de réutilisation', () => {
  afterEach(() => vi.unstubAllGlobals());

  function renderProfile(routes: Record<string, () => Response>) {
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      void init;
      const handler = routes[path];
      return Promise.resolve(
        handler ? handler() : jsonResponse({ user: null }, 404),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AppProviders>
        <PwaProvider>
          <ProfilePage />
        </PwaProvider>
      </AppProviders>,
    );
    return fetchMock;
  }

  it('est décoché tant que rien n’a été consenti', async () => {
    // Le défaut EST la décision : un consentement se donne, il ne se déduit
    // pas d'un silence.
    renderProfile({
      '/api/auth/session': () => jsonResponse(sessionUser(false)),
    });

    const checkbox = await screen.findByRole('checkbox', {
      name: /Autoriser la réutilisation de mes corrections détachées/,
    });
    expect(checkbox).not.toBeChecked();
  });

  it('dit ce que le refus entraîne, pas seulement ce que l’accord permet', async () => {
    // Un refus a lui aussi une conséquence, et la taire laisserait croire que
    // ne rien cocher ne décide de rien.
    renderProfile({
      '/api/auth/session': () => jsonResponse(sessionUser(false)),
    });

    expect(
      await screen.findByText(/Sans cette autorisation, ils sont supprimés/),
    ).toBeInTheDocument();
    // Pseudonymisation, jamais anonymat : un texte libre peut désigner son
    // auteur, et le dire est une obligation, pas une nuance.
    expect(
      screen.getByText(/c’est une pseudonymisation, pas un anonymat/),
    ).toBeInTheDocument();
  });

  it('enregistre l’accord puis son retrait', async () => {
    const fetchMock = renderProfile({
      '/api/auth/session': () => jsonResponse(sessionUser(false)),
      '/api/auth/correction-reuse-consent': () =>
        jsonResponse(sessionUser(true)),
    });

    fireEvent.click(
      await screen.findByRole('checkbox', {
        name: /Autoriser la réutilisation de mes corrections détachées/,
      }),
    );

    await waitFor(() =>
      expect(screen.getByText('Choix enregistré.')).toBeInTheDocument(),
    );
    const consentCall = fetchMock.mock.calls.find(
      ([path]) => path === '/api/auth/correction-reuse-consent',
    );
    expect(consentCall?.[1]?.method).toBe('PATCH');
    expect(JSON.parse(String(consentCall?.[1]?.body))).toEqual({
      consent: true,
    });

    // La case suit désormais l'état que le SERVEUR a renvoyé.
    expect(
      screen.getByRole('checkbox', {
        name: /Autoriser la réutilisation de mes corrections détachées/,
      }),
    ).toBeChecked();
  });

  it('ne prétend pas avoir enregistré ce que le serveur a refusé', async () => {
    // L'écran ne s'avance jamais : une case qui reste cochée après un échec
    // afficherait un consentement qui n'a pas été écrit.
    renderProfile({
      '/api/auth/session': () => jsonResponse(sessionUser(false)),
      '/api/auth/correction-reuse-consent': () =>
        jsonResponse({ error: { code: 'INVALID_REQUEST' } }, 400),
    });

    fireEvent.click(
      await screen.findByRole('checkbox', {
        name: /Autoriser la réutilisation de mes corrections détachées/,
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(/Votre choix n’a pas pu être enregistré/),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText('Choix enregistré.')).not.toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {
        name: /Autoriser la réutilisation de mes corrections détachées/,
      }),
    ).not.toBeChecked();
  });
});
