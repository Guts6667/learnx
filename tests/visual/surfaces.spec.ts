import { expect, type Page, test } from '@playwright/test';

import {
  credentials,
  installJourneyApi,
  installPublicCatalogue,
  lessonSummary,
  moduleSummary,
  program,
} from '../e2e/journey-api';
import { installLongContentPrograms } from './long-content';

/**
 * Baselines for the surfaces a design-system change touches. Public pages need
 * no session; the rest reuse the deterministic journey mock so the pixels never
 * depend on database state.
 */

async function signIn(page: Page) {
  await installJourneyApi(page);
  await page.goto('/login');
  // The mock only authenticates after a registration, matching the e2e suite.
  await page.evaluate(async (input) => {
    await fetch('/api/auth/register', {
      body: JSON.stringify(input),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
  }, credentials);
  await page.goto('/today');
}

async function settle(page: Page) {
  // Web fonts change metrics on load, which would otherwise race the capture.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
}

const publicSurfaces = [
  { name: 'landing', path: '/' },
  { name: 'privacy-policy', path: '/confidentialite' },
  { name: 'login', path: '/login' },
  { name: 'request-access', path: '/request-access' },
  { name: 'not-found', path: '/cette-route-nexiste-pas' },
] as const;

for (const surface of publicSurfaces) {
  test(`public — ${surface.name}`, async ({ page }) => {
    // La seule lecture d'une page publique (V4.5-206). Vide : c'est l'état du
    // produit tant qu'aucun palier n'est activé, et le serveur de test n'a de
    // toute façon pas d'API à interroger.
    await installPublicCatalogue(page);
    await page.goto(surface.path);
    await settle(page);
    await expect(page).toHaveScreenshot(`${surface.name}.png`, {
      fullPage: true,
    });
  });
}

/**
 * La section tarifs avec des paliers (V4.5-213).
 *
 * La capture de `landing` la montre vide — c'est l'état du produit tant
 * qu'aucun palier n'est activé, et il faut le garder. Mais un catalogue vide
 * ne montre aucune carte, donc rien de ce que cette version ajoute : le taux,
 * le bonus, la capacité et la condition d'achat. La grille est `auto-fit` et
 * les trois largeurs la cassent différemment.
 *
 * Cadrée sur la section plutôt que sur la page entière : une seconde capture
 * pleine page ferait trois fichiers de plus à relire pour un seul bloc changé.
 */
test('public — landing pricing tiers', async ({ page }) => {
  await installPublicCatalogue(page, [
    {
      approximateCorrections: '10',
      bonusCredits: '0',
      credits: '300',
      creditsPerEuro: '100',
      currency: 'EUR',
      key: 'entry',
      label: 'Premier pack',
      labelEn: 'First pack',
      oncePerAccount: true,
      priceMinor: '300',
    },
    {
      approximateCorrections: '29',
      bonusCredits: '80',
      credits: '880',
      creditsPerEuro: '110',
      currency: 'EUR',
      key: 'regular',
      label: 'Pack standard',
      labelEn: 'Standard pack',
      oncePerAccount: false,
      priceMinor: '800',
    },
    {
      approximateCorrections: '66',
      bonusCredits: '400',
      credits: '2000',
      creditsPerEuro: '125',
      currency: 'EUR',
      key: 'intensive',
      label: 'Grand pack',
      labelEn: 'Large pack',
      oncePerAccount: false,
      priceMinor: '1600',
    },
  ]);
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Premier pack' }),
  ).toBeVisible();
  await settle(page);
  await expect(page.locator('.landing-pricing')).toHaveScreenshot(
    'landing-pricing-tiers.png',
  );
});

test('app — today', async ({ page }) => {
  await signIn(page);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Aujourd’hui' }),
  ).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('today.png', { fullPage: true });
});

test('app — my programmes', async ({ page }) => {
  await signIn(page);
  await page.goto('/program');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Mes parcours' }),
  ).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('programmes.png', { fullPage: true });
});

/**
 * Même surface, contenu le plus long du corpus (V4.5-UX-002) : trois parcours,
 * titres longs, étapes longues. La capture précédente n'en dit rien — un seul
 * parcours au titre court ne peut pas révéler un débordement de grille.
 */
test('app — my programmes (long content)', async ({ page }) => {
  await signIn(page);
  await installLongContentPrograms(page);
  await page.goto('/program');
  await expect(
    page.getByRole('heading', {
      level: 3,
      name: 'Pilotage de projets IA et ISO/IEC 42001',
    }),
  ).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('programmes-long-content.png', {
    fullPage: true,
  });
});

test('app — discover', async ({ page }) => {
  await signIn(page);
  await page.goto('/discover');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('discover.png', { fullPage: true });
});

test('app — programme detail', async ({ page }) => {
  await signIn(page);
  await page.goto(`/program/${program.slug}`);
  await expect(
    page.getByRole('heading', { level: 1, name: program.title }),
  ).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('programme-detail.png', {
    fullPage: true,
  });
});

test('app — lesson', async ({ page }) => {
  await signIn(page);
  await page.goto(`/program/${program.slug}`);
  await page
    .getByRole('link', {
      name: `Ouvrir ${lessonSummary.title}, module ${moduleSummary.title}, Disponible`,
    })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: lessonSummary.title }),
  ).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('lesson.png', { fullPage: true });
});

/**
 * L'écran d'achat (V4.5-204) : cartes de paliers, historique de commandes et
 * demande exceptionnelle sur la même page. C'est la surface la plus dense de
 * l'espace apprenant, et la grille de paliers est `auto-fit` — trois largeurs
 * la cassent différemment.
 */
test('app — credits', async ({ page }) => {
  await signIn(page);
  await page.goto('/credits');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Mes crédits' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Découverte' })).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('credits.png', { fullPage: true });
});

/**
 * L'écran Profil (V4.5-168).
 *
 * Il n'avait aucune référence visuelle, et il porte depuis peu la case de
 * consentement à la réutilisation — un élément à portée RGPD. Quatre tests
 * unitaires vérifient ce qu'il fait ; aucun ne dit à quoi il ressemble, et
 * « Visual baselines au vert » ne voulait donc rien dire pour cette surface.
 *
 * Capturée décochée, l'état par défaut : c'est celui qu'un apprenant voit sans
 * rien faire, et le défaut est ici la décision — un consentement se donne, il
 * ne se déduit pas d'un silence. La description est la même dans les deux
 * états, donc une seconde capture cochée n'ajouterait que la coche.
 *
 * Cadrée sur `.profile-groups`, et non en pleine page. La première version
 * l'était : en 390 px, la barre de navigation — `position: fixed` — se pose au
 * milieu d'une capture pleine page et recouvre deux lignes de la description
 * du consentement. La page n'est pas cassée, c'est un artefact de cadrage ;
 * mais une référence qui masque justement le texte RGPD ne surveille pas ce
 * qu'on l'a créée pour surveiller. Le cadre retenu porte les quatre cartes de
 * l'écran, et la barre reste couverte par les autres références de l'espace
 * apprenant.
 */
test('app — profile', async ({ page }) => {
  await signIn(page);
  await page.goto('/profile');
  // Le titre de niveau 1 est le nom affiché du compte, pas un libellé fixe :
  // on l'attend par son rôle, sans figer un nom que la fixture décide.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // La case, nommée : sans cette attente la capture pourrait partir avant que
  // la session porte le consentement, et figer un écran incomplet en référence.
  await expect(
    page.getByLabel(
      'Autoriser la conservation de mes textes après le détachement',
    ),
  ).toBeVisible();
  await settle(page);
  await expect(page.locator('.profile-groups')).toHaveScreenshot('profile.png');
});

test('app — notes', async ({ page }) => {
  await signIn(page);
  await page.goto('/notes');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('notes.png', { fullPage: true });
});
