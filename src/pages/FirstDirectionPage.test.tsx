import { fireEvent, render, screen } from '@testing-library/preact';

import { AppProviders } from '@/app/providers';
import { FirstDirectionPage } from '@/pages/FirstDirectionPage';

const routeMock = vi.hoisted(() => vi.fn());
vi.mock('preact-router', () => ({ route: routeMock }));

describe('FirstDirectionPage', () => {
  afterEach(() => routeMock.mockClear());

  it('offers a non-binding first direction and can postpone the choice', () => {
    render(
      <AppProviders>
        <FirstDirectionPage />
      </AppProviders>,
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Comment souhaitez-vous commencer ?',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', {
        name: /Découvrir les parcours disponibles/,
      }),
    ).toBeChecked();
    expect(
      screen.getByRole('radio', { name: /Rejoindre un parcours partagé/ }),
    ).not.toBeChecked();

    fireEvent.click(
      screen.getByRole('button', { name: 'Je déciderai plus tard' }),
    );
    expect(routeMock).toHaveBeenCalledWith('/today', true);
  });

  it('renders the complete choice in English', () => {
    render(
      <AppProviders locale="en">
        <FirstDirectionPage />
      </AppProviders>,
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'How would you like to begin?',
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Interface language')).toHaveValue('en');
    expect(screen.getByRole('button', { name: /Continue/ })).toBeEnabled();
  });
});
