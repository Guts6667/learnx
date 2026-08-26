import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';

import { navigate as route } from '@/app/navigation';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useBackNavigationTarget } from '@/components/layout/BackNavigationContext';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { I18nProvider } from '@/i18n';

vi.mock('@/features/auth/session', () => ({
  useSessionQuery: () => ({
    data: {
      user: {
        displayName: 'Learner',
        email: 'learner@example.com',
        id: 'user-1',
        locale: 'fr',
        role: 'USER',
      },
    },
    isPending: false,
  }),
}));

vi.mock('@/app/navigation', () => ({ navigate: vi.fn() }));

function PageWithStableBackTarget() {
  useBackNavigationTarget({
    href: '/program/programme-test?stage=introduction',
    labelKey: 'navigation.back.program',
  });

  return <h1>Leçon</h1>;
}

function renderWithLocale(children: ReactNode, locale: 'fr' | 'en' = 'fr') {
  return render(<I18nProvider locale={locale}>{children}</I18nProvider>);
}

describe('navigation accessible', () => {
  afterEach(() => vi.restoreAllMocks());

  it('permet de rejoindre directement le contenu principal', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    renderWithLocale(
      <MobileLayout currentPath="/today">
        <h1>Contenu</h1>
      </MobileLayout>,
    );

    fireEvent.click(
      screen.getByRole('link', { name: 'Aller au contenu principal' }),
    );

    expect(document.getElementById('main-content')).toHaveFocus();
  });

  it.each(['/login', '/admin/accounts'])(
    'conserve le même accès direct au contenu dans le shell %s',
    (currentPath) => {
      renderWithLocale(
        <MobileLayout currentPath={currentPath}>
          <h1>Contenu</h1>
        </MobileLayout>,
      );

      const skipLink = screen.getByRole('link', {
        name: 'Aller au contenu principal',
      });

      expect(skipLink).toHaveAttribute('href', '#main-content');
      fireEvent.click(skipLink);
      expect(document.getElementById('main-content')).toHaveFocus();
    },
  );

  it('affiche un retour clavier sur une page secondaire', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    renderWithLocale(
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

  it('conserve la destination explicite vers Mes parcours depuis Découvrir', () => {
    renderWithLocale(
      <MobileLayout currentPath="/discover">
        <h1>Découvrir</h1>
      </MobileLayout>,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Retour à Mes parcours' }),
    );

    expect(route).toHaveBeenCalledWith('/program');
  });

  it('utilise la destination contextuelle stable avant l’historique', () => {
    window.history.pushState({}, '', '/program/programme-test/lesson/demarrer');
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    renderWithLocale(
      <MobileLayout
        canGoBack
        currentPath="/program/programme-test/lesson/demarrer"
      >
        <PageWithStableBackTarget />
      </MobileLayout>,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Retour au programme' }),
    );

    expect(back).not.toHaveBeenCalled();
    expect(route).toHaveBeenCalledWith(
      '/program/programme-test?stage=introduction',
    );
  });

  it('affiche cinq destinations courtes avec des icônes décoratives', () => {
    renderWithLocale(
      <BottomNavigation currentPath="/program/programme-test" />,
    );

    const navigation = screen.getByRole('navigation', {
      name: 'Navigation principale',
    });
    const links = within(navigation).getAllByRole('link');

    expect(links).toHaveLength(5);
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Aujourd’hui',
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
    renderWithLocale(
      <BottomNavigation currentPath="/program/programme-test" />,
    );

    const activeLink = screen.getByRole('link', { name: 'Parcours' });

    expect(activeLink).toHaveAttribute('aria-current', 'page');
    expect(activeLink).toHaveClass('ui-main-navigation__link');
    expect(activeLink).not.toHaveClass('underline');
    expect(
      screen.getByRole('link', { name: 'Aujourd’hui' }),
    ).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('navigation')).toHaveClass(
      'app-main-navigation',
      'app-safe-navigation',
      'ui-main-navigation',
    );
  });

  it('permet de réduire puis de déployer la navigation desktop', () => {
    renderWithLocale(<BottomNavigation currentPath="/today" />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Réduire la barre latérale' }),
    );

    expect(document.documentElement).toHaveAttribute(
      'data-sidebar-collapsed',
      'true',
    );
    expect(
      screen.getByRole('button', { name: 'Déployer la barre latérale' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('utilise un cadre responsive sans limiter le desktop à une largeur mobile', () => {
    renderWithLocale(
      <MobileLayout currentPath="/today">
        <h1>Contenu large</h1>
      </MobileLayout>,
    );

    expect(document.getElementById('main-content')).toHaveClass('app-frame');
    expect(document.getElementById('main-content')).not.toHaveClass('max-w-xl');
  });

  it('isole les routes admin dans le shell Totem sans dupliquer la navigation produit', () => {
    renderWithLocale(
      <MobileLayout currentPath="/admin/accounts">
        <h1>Comptes</h1>
      </MobileLayout>,
    );

    expect(document.querySelector('[data-visual-system="totem"]')).toHaveClass(
      'totem-admin-surface',
    );
    expect(document.getElementById('main-content')).toHaveTextContent(
      'Comptes',
    );
    expect(
      screen.getAllByRole('navigation', {
        name: 'Navigation de l’administration',
      }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole('link', { name: 'Aujourd’hui' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Comptes' })[0]).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it.each([
    '/today',
    '/program',
    '/program/parcours-test',
    '/program/parcours-test/lesson/lecon-test',
    '/program/parcours-test/lesson/lecon-test/quiz',
    '/reviews',
    '/credits',
    '/notes',
    '/profile',
  ])('active Totem sur la surface produit %s', (currentPath) => {
    renderWithLocale(
      <MobileLayout currentPath={currentPath}>
        <h1>Surface produit</h1>
      </MobileLayout>,
    );

    expect(document.querySelector('[data-visual-system="totem"]')).toHaveClass(
      'totem-product-surface',
    );
  });

  it.each(['/login', '/request-access', '/verify-email', '/activate'])(
    "n'affiche aucune navigation privée dans le shell d'authentification %s",
    (currentPath) => {
      renderWithLocale(
        <MobileLayout currentPath={currentPath}>
          <h1>Authentification</h1>
        </MobileLayout>,
      );

      expect(
        screen.queryByRole('navigation', { name: 'Navigation principale' }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'LearnX' })).toHaveAttribute(
        'href',
        '/',
      );
    },
  );

  it('renders long English navigation labels without changing the five-item structure', () => {
    renderWithLocale(
      <BottomNavigation currentPath="/program/programme-test" />,
      'en',
    );

    const navigation = screen.getByRole('navigation', {
      name: 'Main navigation',
    });
    const links = within(navigation).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Today',
      'Learning paths',
      'Review',
      'Notes',
      'Profile',
    ]);
    expect(
      screen
        .getByRole('link', { name: 'Learning paths' })
        .querySelector('span'),
    ).toHaveClass('break-words');
  });

  it.each(['/today', '/program', '/reviews', '/notes', '/profile'])(
    'n’affiche aucune flèche globale sur la racine %s',
    (currentPath) => {
      renderWithLocale(
        <MobileLayout canGoBack currentPath={currentPath}>
          <h1>Racine</h1>
        </MobileLayout>,
      );

      expect(
        screen.queryByRole('button', { name: /Retour|Revenir/ }),
      ).toBeNull();
    },
  );

  it('annonce la destination contextuelle en anglais', () => {
    renderWithLocale(
      <MobileLayout canGoBack currentPath="/program/path/lesson/start">
        <PageWithStableBackTarget />
      </MobileLayout>,
      'en',
    );

    expect(
      screen.getByRole('button', { name: 'Back to the program' }),
    ).toBeInTheDocument();
  });
});
