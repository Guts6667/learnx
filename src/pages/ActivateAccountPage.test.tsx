import { fireEvent, render, screen } from '@testing-library/preact';

import { AppProviders } from '@/app/providers';
import { ActivateAccountPage } from '@/pages/ActivateAccountPage';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

describe('ActivateAccountPage', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/activate#token=' + 'a'.repeat(43));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
  });

  it('creates the account without sending the token in the URL path', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse(
          {
            user: {
              displayName: 'Learner',
              email: 'learner@example.com',
              id: 'user-1',
              role: 'USER',
            },
          },
          201,
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <ActivateAccountPage />
      </AppProviders>,
    );

    fireEvent.input(screen.getByLabelText('Nom affiché'), {
      target: { value: 'Learner' },
    });
    fireEvent.input(screen.getByLabelText('Mot de passe'), {
      target: { value: 'correct-horse-battery-staple' },
    });
    fireEvent.input(screen.getByLabelText('Confirmer le mot de passe'), {
      target: { value: 'correct-horse-battery-staple' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Activer mon compte' }));

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/access-invitations/activate',
        expect.objectContaining({
          body: JSON.stringify({
            displayName: 'Learner',
            password: 'correct-horse-battery-staple',
            token: 'a'.repeat(43),
          }),
          method: 'POST',
        }),
      );
    });
    await vi.waitFor(() => {
      expect(window.location.hash).toBe('');
    });
  });

  it('blocks mismatched passwords before calling the server', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <ActivateAccountPage />
      </AppProviders>,
    );

    fireEvent.input(screen.getByLabelText('Nom affiché'), {
      target: { value: 'Learner' },
    });
    fireEvent.input(screen.getByLabelText('Mot de passe'), {
      target: { value: 'correct-horse-battery-staple' },
    });
    fireEvent.input(screen.getByLabelText('Confirmer le mot de passe'), {
      target: { value: 'different-secure-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Activer mon compte' }));

    expect(
      screen.getByText('Les deux mots de passe doivent être identiques.'),
    ).toHaveAttribute('role', 'alert');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('disables activation when the fragment token is absent', () => {
    window.history.replaceState({}, '', '/activate');
    vi.stubGlobal('fetch', vi.fn());

    render(
      <AppProviders>
        <ActivateAccountPage />
      </AppProviders>,
    );

    expect(
      screen.getByText('Cette invitation est invalide ou incomplète.'),
    ).toHaveAttribute('role', 'alert');
    expect(
      screen.getByRole('button', { name: 'Activer mon compte' }),
    ).toBeDisabled();
  });
});
