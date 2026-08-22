import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConsentGroup } from '@/components/ui/ConsentGroup';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { Notice } from '@/components/ui/Notice';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { StatePanel } from '@/components/ui/StatePanel';
import { TextField } from '@/components/ui/TextField';
import { TotemTheme } from '@/components/ui/TotemTheme';

interface TotemPrimitivesPageProps {
  path?: string;
}

const tableColumns = [
  { key: 'resource', label: 'Ressource' },
  { key: 'status', label: 'État' },
  { key: 'action', label: 'Action disponible' },
] as const;

const tableRows = [
  {
    cells: {
      action: 'Consulter',
      resource: 'Guide de prise en main avec un titre volontairement long',
      status: <Badge tone="info">Disponible</Badge>,
    },
    key: 'guide',
  },
  {
    cells: {
      action: 'Aucune action requise',
      resource: 'Référence archivée',
      status: <Badge>Archivée</Badge>,
    },
    key: 'archive',
  },
] as const;

export function TotemPrimitivesPage({ path }: TotemPrimitivesPageProps) {
  void path;

  return (
    <TotemTheme class="min-h-dvh px-4 py-8 sm:px-6 lg:px-10">
      <div class="mx-auto grid w-full max-w-6xl gap-10">
        <header class="max-w-3xl">
          <p class="text-sm font-medium tracking-[0.12em] text-[var(--color-accent)] uppercase">
            V4-016E · Catalogue de développement
          </p>
          <h1 class="mt-3 text-4xl leading-tight font-medium tracking-[-0.04em] sm:text-6xl">
            Primitives et états Totem
          </h1>
          <p class="mt-4 max-w-2xl text-lg leading-7 text-[var(--color-text-muted)]">
            Cette route locale vérifie la hiérarchie, les états et le reflow des
            composants communs. Elle ne contient aucune donnée financière,
            pédagogique ou utilisateur réelle.
          </p>
        </header>

        <section aria-labelledby="actions-title" class="grid gap-5">
          <h2 class="text-2xl font-medium" id="actions-title">
            Actions, champs et statuts
          </h2>
          <div class="grid gap-5 lg:grid-cols-3">
            <Card>
              <h3 class="font-medium">Actions</h3>
              <div class="mt-4 flex flex-wrap gap-3">
                <Button>Action principale</Button>
                <Button variant="secondary">Action secondaire</Button>
                <NavigationAction href="#states" variant="editorial">
                  Action éditoriale
                </NavigationAction>
                <Button disabled>Action indisponible</Button>
              </div>
            </Card>
            <Card>
              <h3 class="font-medium">Champs</h3>
              <div class="mt-4 grid gap-4">
                <TextField
                  description="Une aide reste distincte du libellé."
                  label="État initial"
                  placeholder="Saisir une valeur"
                />
                <TextField
                  error="Vérifiez la valeur indiquée."
                  label="État en erreur"
                  value="Valeur incomplète"
                />
              </div>
            </Card>
            <Card>
              <h3 class="font-medium">Tags libellés</h3>
              <div class="mt-4 flex flex-wrap gap-2">
                <Badge>En cours</Badge>
                <Badge tone="info">Correction assistée</Badge>
                <Badge tone="warning">À examiner</Badge>
                <Badge tone="danger">Erreur</Badge>
              </div>
            </Card>
          </div>
        </section>

        <section aria-labelledby="signature-title" class="grid gap-5">
          <h2 class="text-2xl font-medium" id="signature-title">
            Progression et attention
          </h2>
          <div class="grid gap-5 lg:grid-cols-3">
            <Card tone="signature">
              <p class="text-xs font-medium tracking-[0.1em] text-[var(--color-accent)] uppercase">
                Surface signature
              </p>
              <h3 class="mt-3 max-w-[18ch] text-xl font-medium">
                Une prochaine étape identifiable
              </h3>
              <p class="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                L’angle corail signe la surface sans encoder son statut.
              </p>
              <ProgressBar
                class="mt-5"
                label="Progression illustrative"
                value={41}
              />
            </Card>
            <Notice title="Une conséquence explicitée" tone="attention">
              Le corail attire l’attention, mais le titre porte toujours le sens
              du message.
            </Notice>
            <Notice title="Action enregistrée" tone="safe">
              L’état sûr utilise un libellé et une structure, jamais le bleu
              seul.
            </Notice>
          </div>
        </section>

        <section aria-labelledby="consents-title" class="grid gap-5">
          <h2 class="text-2xl font-medium" id="consents-title">
            Consentements distincts
          </h2>
          <Card>
            <ConsentGroup
              description="Chaque choix possède son propre libellé et peut être modifié indépendamment."
              legend="Vos préférences"
            >
              <Checkbox
                description="Recevoir uniquement les informations liées au lancement."
                label="Informations de lancement"
              />
              <Checkbox
                description="Candidature séparée pour participer à un pilote."
                label="Programme early adopter"
              />
            </ConsentGroup>
          </Card>
        </section>

        <section aria-labelledby="states-title" class="grid gap-5" id="states">
          <h2 class="text-2xl font-medium" id="states-title">
            États explicites
          </h2>
          <div class="grid gap-4 lg:grid-cols-2">
            <StatePanel status="loading" title="Chargement du contenu">
              Les actions restent indisponibles pendant la récupération.
            </StatePanel>
            <StatePanel status="empty" title="Aucun élément pour le moment">
              L’état vide explique la prochaine action utile sans afficher de
              compteur inutile.
            </StatePanel>
            <StatePanel
              action={<Button variant="secondary">Réessayer</Button>}
              status="error"
              title="Le contenu n’a pas pu être chargé"
            >
              Aucune modification n’a été enregistrée.
            </StatePanel>
            <StatePanel status="safe" title="Modifications enregistrées">
              Le résultat est conservé et aucune autre action n’est requise.
            </StatePanel>
          </div>
        </section>

        <section aria-labelledby="table-title" class="grid gap-5">
          <h2 class="text-2xl font-medium" id="table-title">
            Table responsive
          </h2>
          <ResponsiveTable
            caption="Exemple de ressources"
            columns={tableColumns}
            rows={tableRows}
          />
        </section>
      </div>
    </TotemTheme>
  );
}
