import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Section } from '@/components/ui/Section';
import { TotemTheme } from '@/components/ui/TotemTheme';

export function TotemProductPreviewPage() {
  return (
    <TotemTheme className="totem-product-surface">
      <div className="app-layout min-h-dvh bg-[var(--color-canvas)] text-[var(--color-text)]">
        <header className="app-safe-header border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="app-frame mx-auto flex items-center justify-between gap-3">
            <a
              className="inline-flex min-h-11 items-center rounded-lg text-lg font-semibold"
              href="/design/totem-product"
            >
              LearnX
            </a>
            <span className="ui-text-muted text-sm">Aperçu de design</span>
          </div>
        </header>
        <main
          className="app-safe-main app-frame mx-auto py-8 lg:py-10"
          id="main-content"
          tabIndex={-1}
        >
          <section className="page-layout page-layout--work page-shell">
            <PageHeader
              eyebrow="Aujourd’hui"
              id="totem-product-preview-title"
              title="Une prochaine action claire"
            />
            <Card className="space-y-5" tone="accent">
              <div className="space-y-2">
                <Badge tone="info">Continuer la leçon</Badge>
                <p className="ui-text-muted text-sm font-medium">
                  SourceLab — Docker, API et socle d’ingestion
                </p>
                <h2 className="text-xl font-semibold">
                  Observer la santé d’un service local
                </h2>
                <p className="ui-text-muted text-sm">25 min</p>
              </div>
              <ProgressBar label="Progression du programme" value={34} />
              <NavigationAction href="#main-content" size="lg">
                Continuer
              </NavigationAction>
            </Card>
            <Section
              description="Retrouvez vos autres engagements sans transformer Aujourd’hui en catalogue."
              title="Mes programmes en cours"
            >
              <ul className="ui-list ui-program-list">
                <li>
                  <a className="ui-program-line group" href="#main-content">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold group-hover:text-[var(--color-action)]">
                        Pilotage de projets IA
                      </h3>
                      <p className="ui-text-muted mt-1 text-sm">
                        En cours · 18 %
                      </p>
                    </div>
                    <span className="ui-program-line__action">Reprendre →</span>
                  </a>
                </li>
                <li>
                  <a className="ui-program-line group" href="#main-content">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold group-hover:text-[var(--color-action)]">
                        Fondamentaux de la psychologie
                      </h3>
                      <p className="ui-text-muted mt-1 text-sm">À commencer</p>
                    </div>
                    <span className="ui-program-line__action">Commencer →</span>
                  </a>
                </li>
              </ul>
              <div className="mt-4 flex justify-center">
                <NavigationAction href="/program" variant="ghost">
                  Voir tous mes programmes
                </NavigationAction>
              </div>
            </Section>
          </section>
        </main>
        <BottomNavigation currentPath="/today" />
      </div>
    </TotemTheme>
  );
}
