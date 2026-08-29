import type { Page } from '@playwright/test';

/**
 * Fixture « contenu le plus long » (V4.5-UX-002).
 *
 * Les trente baselines existantes utilisent « Programme E2E » : un titre de
 * trois mots courts, un seul parcours inscrit. Elles prouvent la structure et
 * les points de rupture, pas la robustesse — un titre long réparti sur trois
 * colonnes n'est capturé nulle part. C'est la critique méthodologique de
 * l'audit V4.2, et elle valait toujours après la refonte en cartes d'UX-001.
 *
 * Cette fixture surcharge deux routes APRÈS `installJourneyApi` — Playwright
 * fait gagner la dernière route enregistrée — plutôt que de modifier le mock
 * partagé, qui déplacerait les trente captures existantes pour rien.
 *
 * Toutes les chaînes viennent du corpus réel (`seed/*.json`) : des titres
 * inventés seraient plus longs ou plus courts que ce que le produit affiche.
 */

const enrolled = [
  {
    id: 'program-long-1',
    percent: 62,
    slug: 'pilotage-projets-ia-iso-42001',
    stageTitle: 'Rôle, langage commun et découverte',
    title: 'Pilotage de projets IA et ISO/IEC 42001',
    nextTitle: 'Distinguer automatisation, apprentissage et IA générative',
  },
  {
    id: 'program-long-2',
    percent: 34,
    slug: 'ai-product-engineer-sourcelab',
    stageTitle: 'Intégrer et argumenter à partir des preuves',
    title: 'AI Product Engineer — RAG et évaluation avec SourceLab',
    nextTitle: 'Rédiger une conclusion proportionnée aux preuves',
  },
  {
    id: 'program-long-3',
    percent: 0,
    slug: 'ingenieur-logiciel-production-sourcelab',
    stageTitle: 'Comprendre les responsabilités d’une plateforme produit',
    title: 'SourceLab — Docker, API et socle d’ingestion',
    nextTitle: 'Ce qu’un incident coûte vraiment',
  },
] as const;

export async function installLongContentPrograms(page: Page): Promise<void> {
  await page.route('**/api/me/programs*', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        items: enrolled.map((entry, index) => ({
          enrollment: {
            enrolledAt: '2026-08-03T08:00:00.000Z',
            id: `enrollment-long-${index + 1}`,
            status: 'ACTIVE',
            updatedAt: '2026-08-03T08:00:00.000Z',
            withdrawnAt: null,
          },
          program: {
            canonicalProgramKey: entry.slug,
            description:
              'Cadrer, piloter, gouverner et améliorer des projets d’IA en entreprise.',
            estimatedDurationDays: 56,
            icon: null,
            id: entry.id,
            locale: 'fr',
            publishedVersion: {
              checksum: 'checksum-long',
              id: `version-long-${index + 1}`,
              number: 1,
              publishedAt: '2026-08-03T08:00:00.000Z',
            },
            slug: entry.slug,
            title: entry.title,
          },
          progress:
            entry.percent > 0
              ? {
                  completedAt: null,
                  lastViewedAt: '2026-08-27T08:00:00.000Z',
                  percent: entry.percent,
                  startedAt: '2026-08-03T08:00:00.000Z',
                  targetEndAt: null,
                }
              : null,
        })),
        nextCursor: null,
      },
      status: 200,
    });
  });

  await page.route('**/api/today*', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        action: null,
        hasMorePrograms: false,
        lastActivity: null,
        program: null,
        programCount: enrolled.length,
        programs: enrolled.map((entry) => ({
          id: entry.id,
          lastActivity: null,
          nextAction: {
            estimatedMinutes: 45,
            href: `/program/${entry.slug}`,
            kind: 'NEXT_LESSON',
            lessonTitle: entry.nextTitle,
            moduleTitle: null,
            programId: entry.id,
            programSlug: entry.slug,
            programTitle: entry.title,
            stageTitle: entry.stageTitle,
            title: entry.nextTitle,
          },
          percent: entry.percent,
          resumeHref: `/program/${entry.slug}`,
          slug: entry.slug,
          status: entry.percent > 0 ? 'IN_PROGRESS' : 'NOT_STARTED',
          title: entry.title,
        })),
        reviewsDue: 0,
      },
      status: 200,
    });
  });
}
