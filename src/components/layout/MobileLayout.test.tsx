import { fireEvent, render, screen } from '@testing-library/preact';

import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { MobileLayout } from '@/components/layout/MobileLayout';

describe('navigation accessible', () => {
  afterEach(() => vi.restoreAllMocks());

  it('permet de rejoindre directement le contenu principal', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    render(
      <MobileLayout currentPath="/today">
        <h1>Contenu</h1>
      </MobileLayout>,
    );

    fireEvent.click(
      screen.getByRole('link', { name: 'Aller au contenu principal' }),
    );

    expect(document.getElementById('main-content')).toHaveFocus();
  });

  it('affiche un retour clavier sur une page secondaire', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    render(
      <MobileLayout canGoBack currentPath="/notes/note-1">
        <h1>Note</h1>
      </MobileLayout>,
    );

    const button = screen.getByRole('button', {
      name: 'Revenir à la page précédente',
    });
    button.focus();
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.click(button);

    expect(button).toHaveFocus();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('annonce la page active sans dépendre uniquement de la couleur', () => {
    render(<BottomNavigation currentPath="/program/programme-test" />);

    expect(
      screen.getByRole('link', { name: /programmes.*page actuelle/i }),
    ).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('navigation')).toHaveClass('app-safe-navigation');
  });

  it('utilise un cadre responsive sans limiter le desktop à une largeur mobile', () => {
    render(
      <MobileLayout currentPath="/today">
        <h1>Contenu large</h1>
      </MobileLayout>,
    );

    expect(document.getElementById('main-content')).toHaveClass('app-frame');
    expect(document.getElementById('main-content')).not.toHaveClass('max-w-xl');
  });
});
