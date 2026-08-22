import type { RoutableProps } from 'preact-router';

import { PrimaryResumeCard } from '@/components/product/PrimaryResumeCard';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { ListRow } from '@/components/ui/ListRow';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { PageHeader } from '@/components/ui/PageHeader';
import { Section } from '@/components/ui/Section';
import { TotemTheme } from '@/components/ui/TotemTheme';

export function TotemProductPreviewPage(props: RoutableProps) {
  void props;

  return (
    <TotemTheme class="totem-product-surface">
      <div class="app-layout min-h-dvh bg-[var(--color-canvas)] text-[var(--color-text)]">
        <header class="app-safe-header border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div class="app-frame mx-auto flex items-center justify-between gap-3">
            <a class="text-lg font-semibold" href="/design/totem-product">
              LearnX
            </a>
            <span class="ui-text-muted text-sm">Aperçu de design</span>
          </div>
        </header>
        <main
          class="app-safe-main app-frame mx-auto py-8 lg:py-10"
          id="main-content"
          tabindex={-1}
        >
          <section class="page-layout page-layout--work page-shell">
            <PageHeader
              eyebrow="Aujourd’hui"
              id="totem-product-preview-title"
              title="Une prochaine action claire"
            />
            <PrimaryResumeCard
              actionHref="#main-content"
              actionLabel="Continuer"
              eyebrow="SourceLab — Docker, API et socle d’ingestion · Continuer la leçon"
              metadata={['25 min', 'Observabilité locale']}
              progress={{ label: 'Progression du programme', value: 34 }}
              supportingText="Votre travail et vos notes sont enregistrés."
              title="Observer la santé d’un service local"
            />
            <Section
              description="Retrouvez vos autres engagements sans transformer Aujourd’hui en catalogue."
              title="Mes programmes en cours"
            >
              <ul class="ui-list">
                <li>
                  <ListRow
                    aside={
                      <NavigationAction href="#main-content" variant="ghost">
                        Reprendre
                      </NavigationAction>
                    }
                  >
                    <h3 class="font-semibold">Pilotage de projets IA</h3>
                    <p class="ui-text-muted mt-1 text-sm">En cours · 18 %</p>
                  </ListRow>
                </li>
                <li>
                  <ListRow
                    aside={
                      <NavigationAction href="#main-content" variant="ghost">
                        Commencer
                      </NavigationAction>
                    }
                  >
                    <h3 class="font-semibold">Fondamentaux de la psychologie</h3>
                    <p class="ui-text-muted mt-1 text-sm">Pas encore commencé</p>
                  </ListRow>
                </li>
              </ul>
            </Section>
          </section>
        </main>
        <BottomNavigation currentPath="/today" />
      </div>
    </TotemTheme>
  );
}
