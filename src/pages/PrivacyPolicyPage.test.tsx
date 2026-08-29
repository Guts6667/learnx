import { render, screen } from '@testing-library/react';

import { AppProviders } from '@/app/providers';
import { privacyPolicy } from '@/features/legal/privacy-policy';
import { PrivacyPolicyPage } from '@/pages/PrivacyPolicyPage';

describe('PrivacyPolicyPage', () => {
  it('rend chaque section du document, sans en perdre une', () => {
    render(
      <AppProviders>
        <PrivacyPolicyPage />
      </AppProviders>,
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Politique de confidentialité',
      }),
    ).toBeInTheDocument();

    // Une section muette passerait inaperçue : la page resterait cohérente,
    // simplement amputée d'une obligation d'information.
    for (const section of privacyPolicy.fr.sections) {
      expect(
        screen.getByRole('heading', { level: 2, name: section.heading }),
      ).toBeInTheDocument();
    }
  });

  it('affiche les champs que le propriétaire n’a pas encore renseignés', () => {
    render(
      <AppProviders>
        <PrivacyPolicyPage />
      </AppProviders>,
    );

    // Décision produit : un crochet visible vaut mieux qu'une page juridique à
    // moitié fausse. Ce test empêche qu'on « nettoie » l'affichage sans que
    // le champ soit renseigné.
    expect(
      screen.getByText(/nom \/ statut \/ adresse du Propriétaire/),
    ).toBeInTheDocument();
  });

  it('n’exige aucun compte et n’expose aucune action de session', () => {
    render(
      <AppProviders>
        <PrivacyPolicyPage />
      </AppProviders>,
    );

    // La page doit rester lisible par quelqu'un qui n'a pas de compte — c'est
    // la population qui a le plus de raisons de la lire avant de candidater.
    expect(
      screen.queryByRole('button', { name: /Se déconnecter/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/login',
    );
  });
});
