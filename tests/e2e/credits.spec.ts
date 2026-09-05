import { expect, type Page, test } from '@playwright/test';

import {
  credentials,
  creditOrderId,
  fakeProviderOrigin,
  installFulfilledCreditsOrder,
  installJourneyApi,
} from './journey-api';

/**
 * L'achat de crédits de bout en bout (V4.5-204), contre un faux prestataire.
 *
 * Le parcours réel sort du site : notre serveur crée une session, le
 * navigateur part chez le prestataire, et c'est un webhook — pas le retour du
 * navigateur — qui attribue les crédits. Le faux prestataire ci-dessous sert
 * exactement à ça : il tient la page hors de notre origine, puis renvoie sur
 * `success_url`. Ce que le test vérifie est donc la chose qui compte : au
 * retour, l'écran annonce l'attente et non l'attribution, tant que la commande
 * ne la porte pas.
 */

async function signIn(page: Page) {
  await installJourneyApi(page);
  await page.goto('/login');
  await page.evaluate(async (input) => {
    await fetch('/api/auth/register', {
      body: JSON.stringify(input),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
  }, credentials);
}

/** Une page de paiement hors origine, qui ne sait que renvoyer chez nous. */
async function installFakeProvider(page: Page, appOrigin: string) {
  await page.route(`${fakeProviderOrigin}/**`, async (route) => {
    await route.fulfill({
      body: `<!doctype html><meta charset="utf-8"><title>Faux prestataire</title>
<a id="pay" href="${appOrigin}/credits?checkout=success&order=${creditOrderId}">Payer</a>`,
      contentType: 'text/html',
      status: 200,
    });
  });
}

test('achète un palier, revient du prestataire et n’annonce les crédits qu’une fois la commande honorée', async ({
  baseURL,
  page,
}) => {
  await signIn(page);
  await installFakeProvider(page, String(baseURL));

  await page.goto('/credits');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Mes crédits' }),
  ).toBeVisible();
  // Le prix vient du catalogue : « 15,00 € » pour 1500 centimes, sans qu'un
  // montant soit écrit dans l'écran.
  await expect(page.getByRole('heading', { name: 'Découverte' })).toBeVisible();
  await expect(page.getByText('100 crédits')).toBeVisible();
  await expect(page.getByText(/15,00/u)).toBeVisible();
  await expect(page.getByText('Aucune commande')).toBeVisible();

  await page.getByRole('button', { name: 'Acheter Découverte' }).click();

  // Le navigateur a bien quitté notre origine pour la page de paiement.
  await expect(page).toHaveURL(new RegExp(`^${fakeProviderOrigin}/pay/`, 'u'));
  await page.locator('#pay').click();

  await expect(page).toHaveURL(/\/credits\?checkout=success/u);
  await expect(
    page.getByRole('heading', { name: 'Paiement reçu' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Crédits attribués' }),
  ).toBeHidden();
  await expect(page.getByText('Paiement en cours')).toBeVisible();

  // Le webhook honore la commande ; l'écran ne le dit qu'à partir de là.
  await installFulfilledCreditsOrder(page);
  await page.getByRole('button', { name: 'Actualiser' }).click();

  await expect(
    page.getByRole('heading', { name: 'Crédits attribués' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Actualiser' })).toBeHidden();
});

test('dit l’abandon sans rien prélever ni rien promettre', async ({ page }) => {
  await signIn(page);

  await page.goto('/credits?checkout=cancelled');

  await expect(
    page.getByRole('heading', { name: 'Achat abandonné' }),
  ).toBeVisible();
  await expect(
    page.getByText('Aucun crédit n’a été ajouté à votre solde.'),
  ).toBeVisible();
});

test('n’offre aucun achat quand la vente est fermée, et le dit', async ({
  page,
}) => {
  await signIn(page);
  // L'état de la vente voyage avec le catalogue (V4.5-205) : l'écran le sait
  // avant le clic, au lieu de l'apprendre de l'échec d'un achat qu'il vient de
  // proposer.
  await page.route('**/api/credits/packs', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        // La réponse porte la forme entière du contrat (V4.5-212) : l'écran
        // VÉRIFIE le catalogue, donc un palier amputé d'un champ dérivé ne
        // rend pas « vente fermée », il rend l'état d'erreur.
        correctionQuoteCredits: '30',
        correctionReservationCredits: '41',
        packs: [
          {
            credits: '100',
            currency: 'EUR',
            key: 'starter',
            label: 'Découverte',
            labelEn: 'Starter',
            oncePerAccount: false,
            recommended: false,
            priceMinor: '1500',
            approximateCorrections: '3',
            bonusCredits: '-1400',
            creditsPerEuro: '6',
          },
        ],
        paymentsEnabled: false,
      },
    });
  });

  await page.goto('/credits');

  await expect(
    page.getByRole('heading', { name: 'L’achat de crédits est fermé' }),
  ).toBeVisible();
  // Les paliers restent : une page vide ressemblerait à une panne.
  await expect(page.getByRole('heading', { name: 'Découverte' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Acheter Découverte' }),
  ).toHaveCount(0);
});
