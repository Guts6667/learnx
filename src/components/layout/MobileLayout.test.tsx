import { fireEvent, render, screen, within } from '@testing-library/preact';
import { route } from 'preact-router';

import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useBackNavigationTarget } from '@/components/layout/BackNavigationContext';
import { MobileLayout } from '@/components/layout/MobileLayout';

vi.mock('preact-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('preact-router')>()),
  route: vi.fn(),
}));

function PageWithStableBackTarget() {
  useBackNavigationTarget('/program/programme-test/module/premiers-pas');

  return <h1>Leçon</h1>;
}

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

  it('utilise la destination contextuelle stable avant l’historique', () => {
    window.history.pushState(
      {},
      '',
      '/program/programme-test/lesson/demarrer',
    );
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    render(
      <MobileLayout
        canGoBack
        currentPath="/program/programme-test/lesson/demarrer"
      >
        <PageWithStableBackTarget />
      </MobileLayout>,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Revenir à la page précédente' }),
    );

    expect(back).not.toHaveBeenCalled();
    expect(route).toHaveBeenCalledWith(
      '/program/programme-test/module/premiers-pas',
    );
  });

  it('affiche cinq destinations courtes avec des icônes décoratives', () => {
    render(<BottomNavigation currentPath="/program/programme-test" />);

    const navigation = screen.getByRole('navigation', {
      name: 'Navigation principale',
    });
    const links = within(navigation).getAllByRole('link');

    expect(links).toHaveLength(5);
    expect(links.map((link) => link.textContent)).toEqual([
      'Accueil',
      'Parcours',
      'Réviser',
      'Notes',
      'Profil',
    ]);

    for (const link of links) {
      const icon = link.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(icon).toHaveAttribute('focusable', 'false');
    }
  });

  it('annonce et matérialise la page active sans simple soulignement', () => {
    render(<BottomNavigation currentPath="/program/programme-test" />);

    const activeLink = screen.getByRole('link', { name: 'Parcours' });

    expect(activeLink).toHaveAttribute('aria-current', 'page');
    expect(activeLink).toHaveClass('bg-cyan-400/15', 'ring-1');
    expect(activeLink).not.toHaveClass('underline');
    expect(screen.getByRole('link', { name: 'Accueil' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('navigation')).toHaveClass(
      'app-main-navigation',
      'app-safe-navigation',
    );
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
