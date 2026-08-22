import type { RoutableProps } from 'preact-router';

import { PrimaryResumeCard } from '@/components/product/PrimaryResumeCard';
import { ProductPageHeader } from '@/components/product/ProductPageHeader';
import { ProductRail } from '@/components/product/ProductRail';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { NavigationAction } from '@/components/ui/NavigationAction';
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
            <ProductPageHeader
              description="Une priorité claire, sans masquer les autres parcours en cours."
              eyebrow="Aujourd’hui"
              id="totem-product-preview-title"
              summary={{
                description:
                  'Votre dernière activité reste la première action proposée.',
                eyebrow: 'Aujourd’hui',
                facts: [
                  { label: 'Parcours en cours', value: 3 },
                  { label: 'Révisions dues', value: 2 },
                ],
                title: 'Reprendre avant d’explorer',
              }}
              title="Une prochaine action claire"
            />
            <div class="totem-product-layout">
              <div class="totem-product-main">
                <PrimaryResumeCard
                  actionHref="#main-content"
                  actionLabel="Continuer"
                  eyebrow="SourceLab — Docker, API et socle d’ingestion · Continuer la leçon"
                  metadata={['25 min', 'Observabilité locale']}
                  progress={{ label: 'Progression du programme', value: 34 }}
                  supportingText="Votre travail et vos notes sont enregistrés."
                  title="Observer la santé d’un service local"
                />
                <dl class="totem-product-inline-facts">
                  <div>
                    <dd>2</dd>
                    <dt>révisions à faire</dt>
                  </div>
                  <div>
                    <dd>3</dd>
                    <dt>parcours en cours</dt>
                  </div>
                </dl>
              </div>
              <ProductRail
                action={
                  <NavigationAction href="#main-content" variant="secondary">
                    Voir tous les parcours
                  </NavigationAction>
                }
                description="Reprenez un autre parcours exactement où vous l’avez laissé."
                eyebrow="Vos autres parcours"
                id="totem-product-preview-other-programs"
                title="Continuer ailleurs"
              >
                <ul class="totem-product-rows">
                <li>
                  <article class="totem-product-row">
                    <div class="totem-product-row__content">
                      <h3>Pilotage de projets IA</h3>
                      <p class="ui-text-muted mt-1 text-sm">En cours · 18 %</p>
                    </div>
                    <NavigationAction
                      class="totem-product-row__action"
                      href="#main-content"
                      variant="ghost"
                    >
                      Reprendre
                    </NavigationAction>
                  </article>
                </li>
                <li>
                  <article class="totem-product-row">
                    <div class="totem-product-row__content">
                      <h3>Fondamentaux de la psychologie</h3>
                      <p class="ui-text-muted mt-1 text-sm">
                        Pas encore commencé
                      </p>
                    </div>
                    <NavigationAction
                      class="totem-product-row__action"
                      href="#main-content"
                      variant="ghost"
                    >
                      Commencer
                    </NavigationAction>
                  </article>
                </li>
                </ul>
              </ProductRail>
            </div>
          </section>
        </main>
        <BottomNavigation currentPath="/today" />
      </div>
    </TotemTheme>
  );
}
