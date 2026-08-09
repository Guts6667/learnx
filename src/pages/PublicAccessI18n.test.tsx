import { render, screen } from '@testing-library/preact';

import { AppProviders } from '@/app/providers';
import { AccessRequestPage } from '@/pages/AccessRequestPage';
import { LoginPage } from '@/pages/LoginPage';
import { VerifyEmailPage } from '@/pages/VerifyEmailPage';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}

describe('public access pages i18n', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
  });

  it('renders the sign-in form in English', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ user: null }))),
    );

    render(
      <AppProviders locale="en">
        <LoginPage />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sign in' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeRequired();
    expect(screen.getByLabelText('Password')).toBeRequired();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('renders the access request form in English without a password', () => {
    render(
      <AppProviders locale="en">
        <AccessRequestPage />
      </AppProviders>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Request access' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeRequired();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });

  it('announces an invalid verification link in English', () => {
    window.history.replaceState({}, '', '/verify-email');

    render(
      <AppProviders locale="en">
        <VerifyEmailPage />
      </AppProviders>,
    );

    expect(
      screen.getByText('This verification link is invalid or incomplete.'),
    ).toHaveAttribute('role', 'alert');
    expect(
      screen.getByRole('button', { name: 'Verify my address' }),
    ).toBeDisabled();
  });
});
