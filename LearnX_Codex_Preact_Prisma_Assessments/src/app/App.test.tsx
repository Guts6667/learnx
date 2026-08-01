import { render, screen } from '@testing-library/preact';

import { App } from '@/app/App';

describe('App', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/today');
  });

  it('affiche la page Aujourd’hui et la navigation basse', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Aujourd’hui',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toHaveAccessibleName(
      'Navigation principale',
    );
    expect(screen.getByRole('link', { name: 'Programmes' })).toHaveAttribute(
      'href',
      '/program',
    );
  });

  it('affiche une page 404 pour une route inconnue', () => {
    window.history.pushState({}, '', '/inconnue');

    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Page introuvable' }),
    ).toBeInTheDocument();
  });
});
