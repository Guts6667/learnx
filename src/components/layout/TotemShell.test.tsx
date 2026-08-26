import { render, screen } from '@testing-library/react';

import {
  TotemAppShell,
  TotemPublicShell,
} from '@/components/layout/TotemShell';

describe('Totem shells', () => {
  it('sépare navigation, en-tête, contenu, rail et navigation mobile', () => {
    render(
      <TotemAppShell
        bottomNavigation={<nav aria-label="Navigation mobile">Mobile</nav>}
        pageHeader={<h1>Catalogue</h1>}
        rail={<section aria-label="Contexte">Contexte</section>}
        sidebar={<nav aria-label="Navigation principale">Principal</nav>}
        topbar={<div>Compte</div>}
      >
        <p>Contenu principal</p>
      </TotemAppShell>,
    );

    expect(
      screen.getByRole('navigation', { name: 'Navigation principale' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Catalogue' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Contenu principal');
    expect(
      screen.getByRole('region', { name: 'Contexte' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Navigation mobile' }),
    ).toBeInTheDocument();
  });

  it('formalise les régions publiques sans imposer leur contenu', () => {
    render(
      <TotemPublicShell
        footer={<nav aria-label="Pied de page">Confidentialité</nav>}
        navigation={<nav aria-label="Navigation publique">Recherche</nav>}
        skipLinkLabel="Aller au contenu"
      >
        <h1>LearnX</h1>
      </TotemPublicShell>,
    );

    expect(
      screen.getByRole('navigation', { name: 'Navigation publique' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('LearnX');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(
      screen.getByRole('link', { name: 'Aller au contenu' }),
    ).toHaveAttribute('href', '#main-content');
    expect(
      screen.getByRole('navigation', { name: 'Pied de page' }),
    ).toBeInTheDocument();
  });
});
