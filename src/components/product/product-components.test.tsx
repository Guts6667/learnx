import { cleanup, render, screen } from '@testing-library/react';

import { PrimaryResumeCard } from '@/components/product/PrimaryResumeCard';
import { ProductPageHeader } from '@/components/product/ProductPageHeader';
import { ProductRail } from '@/components/product/ProductRail';

describe('product compositions', () => {
  afterEach(() => cleanup());

  it('rend une reprise complète avec métadonnées, progression et contenu', () => {
    render(
      <PrimaryResumeCard
        actionHref="/lessons/next"
        actionLabel="Continuer"
        eyebrow="Prochaine étape"
        metadata={['20 min', 'Leçon 2']}
        progress={{ label: 'Progression', value: 35 }}
        supportingText="Reprenez exactement où vous vous êtes arrêté."
        title="Définir le contrat"
      >
        <p>Contexte conservé</p>
      </PrimaryResumeCard>,
    );

    expect(
      screen.getByText('Reprenez exactement où vous vous êtes arrêté.'),
    ).toBeVisible();
    expect(screen.getByRole('list')).toHaveTextContent('20 minLeçon 2');
    expect(
      screen.getByRole('progressbar', { name: 'Progression' }),
    ).toHaveAttribute('aria-valuenow', '35');
    expect(screen.getByText('Contexte conservé')).toBeVisible();
    expect(screen.getByRole('link', { name: /Continuer/ })).toHaveAttribute(
      'href',
      '/lessons/next',
    );
  });

  it('rend une reprise minimale sans blocs optionnels', () => {
    render(
      <PrimaryResumeCard
        actionHref="/programs"
        actionLabel="Voir"
        eyebrow="Parcours"
        title="Programme disponible"
      />,
    );

    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByRole('link', { name: /Voir/ })).toBeVisible();
  });

  it('rend un en-tête avec résumé éditorial complet', () => {
    render(
      <ProductPageHeader
        description="Description principale"
        eyebrow="Aujourd’hui"
        id="today-title"
        summary={{
          description: 'Synthèse courte',
          eyebrow: 'À retenir',
          facts: [
            { label: 'Durée', value: '25 min' },
            { label: 'Avancement', value: <span>41 %</span> },
          ],
          title: 'Une priorité claire',
        }}
        title="Votre prochaine action"
      />,
    );

    expect(screen.getByText('Description principale')).toBeVisible();
    expect(screen.getByText('Synthèse courte')).toBeVisible();
    expect(screen.getByText('Durée')).toBeVisible();
    expect(screen.getByText('41 %')).toBeVisible();
  });

  it('rend un en-tête minimal et un résumé sans faits', () => {
    const { rerender } = render(
      <ProductPageHeader
        eyebrow="Profil"
        id="profile-title"
        title="Préférences"
      />,
    );
    expect(screen.queryByRole('complementary')).toBeNull();

    rerender(
      <ProductPageHeader
        eyebrow="Profil"
        id="profile-title"
        summary={{ eyebrow: 'Compte', facts: [], title: 'Rayan' }}
        title="Préférences"
      />,
    );
    expect(screen.getByRole('complementary')).toHaveTextContent('CompteRayan');
    expect(screen.queryByRole('definition')).toBeNull();
  });

  it('rend les variantes complète et minimale du rail', () => {
    const { rerender } = render(
      <ProductRail
        action={<button type="button">Tout afficher</button>}
        description="Ressources liées à la leçon"
        eyebrow="Contexte"
        id="resource-rail"
        title="Ressources"
      >
        <p>Une référence</p>
      </ProductRail>,
    );
    expect(screen.getByText('Ressources liées à la leçon')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Tout afficher' })).toBeVisible();

    rerender(
      <ProductRail eyebrow="Contexte" id="resource-rail" title="Ressources">
        <p>Aucune ressource</p>
      </ProductRail>,
    );
    expect(screen.queryByText('Ressources liées à la leçon')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Aucune ressource')).toBeVisible();
  });
});
