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

  it('nomme l’éditeur responsable du traitement', () => {
    render(
      <AppProviders>
        <PrivacyPolicyPage />
      </AppProviders>,
    );

    // Une politique de confidentialité sans responsable de traitement
    // identifiable ne remplit pas son objet, quelle que soit la qualité du
    // reste du texte.
    expect(screen.getByText(/SIREN 820 401 990/)).toBeInTheDocument();
    // L'adresse de contact figure deux fois dans le document : sous « Qui est
    // responsable » et sous « Vos droits ». C'est voulu — un lecteur qui
    // cherche à exercer un droit ne devrait pas avoir à remonter la page.
    expect(screen.getAllByText(/support@learn-x\.app/).length).toBeGreaterThan(
      1,
    );
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

  it('garde l’emphase des mots juridiquement porteurs', () => {
    render(
      <AppProviders>
        <PrivacyPolicyPage />
      </AppProviders>,
    );

    // « non réversible » qualifie la seule garantie que la page donne sur
    // l'effacement. Rendue en texte simple, la phrase reste vraie mais cesse
    // de signaler ce sur quoi le lecteur doit s'arrêter.
    const emphasised = document.querySelectorAll('.legal-section strong');
    expect(emphasised.length).toBeGreaterThan(0);
    expect(
      [...emphasised].some((node) =>
        node.textContent?.includes('non réversible'),
      ),
    ).toBe(true);
  });
});
