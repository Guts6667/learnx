import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { TextField } from '@/components/ui/TextField';
import {
  type AdminLesson,
  type AdminLessonSummary,
  type AdminModule,
  type AdminModuleSummary,
  type AdminNavigationResponse,
  type AdminNavigationTarget,
  type AdminProgram,
  type AdminProgramSummary,
  type AdminStage,
  type PublicationMode,
  type PublicationPlan,
  type PublicationTargetType,
  useAdminCurriculumMutation,
  useAdminNavigationQuery,
} from '@/features/admin/queries';
import { ApiClientError } from '@/lib/api-client';

interface AdminPageProps {
  lessonId?: string;
  moduleId?: string;
  path?: string;
  programId?: string;
  stageId?: string;
}

interface BreadcrumbItem {
  href?: string;
  label: string;
}

function StatusBadge({ isPublished }: { isPublished: boolean }) {
  return (
    <Badge tone={isPublished ? 'success' : 'warning'}>
      {isPublished ? 'Publié' : 'Brouillon'}
    </Badge>
  );
}

function ProgramStatusBadge({
  status,
}: {
  status: AdminProgramSummary['status'];
}) {
  if (status === 'ARCHIVED') return <Badge>Archivé</Badge>;

  return <StatusBadge isPublished={status === 'ACTIVE'} />;
}

function VisibilityBadge({
  visibility,
}: {
  visibility: AdminProgramSummary['visibility'];
}) {
  return (
    <Badge tone={visibility === 'PUBLIC' ? 'success' : 'warning'}>
      {visibility === 'PUBLIC' ? 'Visible par les membres' : 'Privé'}
    </Badge>
  );
}

function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Fil d’Ariane">
      <ol class="flex flex-wrap items-center gap-2 text-sm text-slate-400">
        {items.map((item, index) => (
          <li class="flex items-center gap-2" key={`${item.label}-${index}`}>
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <a
                class="inline-flex min-h-11 items-center rounded-lg text-cyan-300 hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                href={item.href}
              >
                {item.label}
              </a>
            ) : (
              <span aria-current="page" class="text-slate-200">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function getMutationError(error: unknown): string {
  if (
    error instanceof ApiClientError &&
    error.code === 'PUBLICATION_PLAN_STALE'
  ) {
    return 'Cet aperçu n’est plus à jour. Relancez la prévisualisation avant de confirmer.';
  }
  if (error instanceof ApiClientError && error.code === 'PUBLICATION_BLOCKED') {
    return 'La publication reste bloquée par une précondition pédagogique.';
  }
  if (error instanceof ApiClientError && error.code === 'LESSON_NOT_READY') {
    return 'Publication impossible : vérifiez les évaluations des notions obligatoires.';
  }

  return 'La modification n’a pas pu être enregistrée.';
}

function changeLabel(change: PublicationPlan['changes'][number]): string {
  const verb =
    change.to === true || change.to === 'ACTIVE' ? 'Publier' : 'Dépublier';
  const type = {
    LESSON: 'la leçon',
    MODULE: 'le module',
    PROGRAM: 'le programme',
    STAGE: 'l’étape',
  }[change.type];

  return `${verb} ${type} « ${change.title} »`;
}

function PublicationAction({
  isPublished,
  targetId,
  targetTitle,
  targetType,
}: {
  isPublished: boolean;
  targetId: string;
  targetTitle: string;
  targetType: PublicationTargetType;
}) {
  const mutation = useAdminCurriculumMutation();
  const [mode, setMode] = useState<PublicationMode>('PARENT_ONLY');
  const [plan, setPlan] = useState<PublicationPlan>();
  const [success, setSuccess] = useState<string>();
  const action = isPublished ? 'UNPUBLISH' : 'PUBLISH';
  const effectiveMode = action === 'PUBLISH' ? 'FULL' : mode;
  const actionLabel = isPublished ? 'Dépublier' : 'Publier';

  async function preview() {
    setSuccess(undefined);
    try {
      setPlan(
        await mutation.previewPublication({
          action,
          mode: effectiveMode,
          targetId,
          targetType,
        }),
      );
    } catch {
      setPlan(undefined);
    }
  }

  async function apply() {
    if (!plan) return;

    try {
      await mutation.applyPublication({
        action: plan.action,
        mode: plan.mode,
        planId: plan.planId,
        targetId: plan.target.id,
        targetType: plan.target.type,
      });
      setPlan(undefined);
      setSuccess(`${actionLabel} : modification enregistrée.`);
    } catch {
      // L’erreur normalisée est annoncée dans la zone de confirmation.
    }
  }

  return (
    <section aria-labelledby={`publication-${targetId}`} class="space-y-3">
      <h3 class="font-semibold" id={`publication-${targetId}`}>
        Publication de « {targetTitle} »
      </h3>
      {isPublished ? (
        <fieldset class="space-y-2 text-sm">
          <legend class="font-medium text-slate-200">
            Portée de la dépublication
          </legend>
          <label class="flex min-h-11 items-center gap-2">
            <input
              checked={mode === 'PARENT_ONLY'}
              name={`publication-mode-${targetId}`}
              onChange={() => {
                setMode('PARENT_ONLY');
                setPlan(undefined);
              }}
              type="radio"
            />
            Masquer seulement ce niveau
          </label>
          <label class="flex min-h-11 items-center gap-2">
            <input
              checked={mode === 'FULL'}
              name={`publication-mode-${targetId}`}
              onChange={() => {
                setMode('FULL');
                setPlan(undefined);
              }}
              type="radio"
            />
            Dépublier toute la branche
          </label>
        </fieldset>
      ) : null}
      <Button
        isLoading={mutation.isPending && !plan}
        onClick={() => void preview()}
        size="sm"
        variant={isPublished ? 'danger' : 'primary'}
      >
        Prévisualiser — {actionLabel.toLowerCase()}
      </Button>
      {success ? (
        <p class="text-sm text-emerald-200" role="status">
          {success}
        </p>
      ) : null}
      {plan ? (
        <Card aria-live="polite" class="space-y-4 bg-slate-900" role="region">
          <h4 class="font-semibold">Aperçu avant confirmation</h4>
          <p class="text-sm text-slate-300">
            {plan.changes.length === 0
              ? 'L’état demandé est déjà appliqué.'
              : `${plan.changes.length} élément${plan.changes.length > 1 ? 's' : ''} concerné${plan.changes.length > 1 ? 's' : ''}.`}
          </p>
          {plan.changes.length > 0 ? (
            <ul class="list-disc space-y-1 pl-5 text-sm text-slate-300">
              {plan.changes.map((change) => (
                <li key={`${change.type}-${change.id}`}>
                  {changeLabel(change)}
                </li>
              ))}
            </ul>
          ) : null}
          {plan.warnings.map((warning) => (
            <p class="text-sm text-amber-200" key={warning}>
              {warning}
            </p>
          ))}
          {plan.blockers.length > 0 ? (
            <div class="space-y-2" role="alert">
              <p class="font-semibold text-red-200">Publication impossible</p>
              <ul class="list-disc space-y-1 pl-5 text-sm text-red-200">
                {plan.blockers.map((blocker) => (
                  <li key={`${blocker.code}-${blocker.id}`}>
                    {blocker.title} — {blocker.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {mutation.error ? (
            <ErrorState description={getMutationError(mutation.error)} />
          ) : null}
          <div class="flex flex-wrap gap-3">
            <Button
              disabled={plan.blockers.length > 0}
              isLoading={mutation.isPending}
              onClick={() => void apply()}
              variant={isPublished ? 'danger' : 'primary'}
            >
              Confirmer — {actionLabel.toLowerCase()}
            </Button>
            <Button onClick={() => setPlan(undefined)} variant="ghost">
              Annuler
            </Button>
          </div>
        </Card>
      ) : mutation.error ? (
        <ErrorState description={getMutationError(mutation.error)} />
      ) : null}
    </section>
  );
}

function ProgramVisibilityAction({ program }: { program: AdminProgram }) {
  const mutation = useAdminCurriculumMutation();
  const nextVisibility = program.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';
  const [isConfirming, setIsConfirming] = useState(false);
  const [success, setSuccess] = useState(false);

  async function apply() {
    setSuccess(false);
    try {
      await mutation.updateProgramVisibility(program.id, {
        updatedAt: program.updatedAt,
        visibility: nextVisibility,
      });
      setIsConfirming(false);
      setSuccess(true);
    } catch {
      // L’erreur normalisée est rendue ci-dessous.
    }
  }

  return (
    <section aria-labelledby={`visibility-${program.id}`} class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="font-semibold" id={`visibility-${program.id}`}>
          Visibilité du programme
        </h3>
        <VisibilityBadge visibility={program.visibility} />
      </div>
      <p class="text-sm leading-6 text-slate-300">
        Un programme public et publié est consultable par les membres LearnX
        authentifiés. Les brouillons restent privés et la validation scientifique
        est indépendante.
      </p>
      {isConfirming ? (
        <Card class="space-y-3 bg-slate-900" role="alertdialog">
          <p class="text-sm text-slate-200">
            {nextVisibility === 'PUBLIC'
              ? 'Rendre ce programme visible par tous les membres une fois publié ?'
              : 'Rendre ce programme accessible uniquement à son propriétaire ?'}
          </p>
          <div class="flex flex-wrap gap-3">
            <Button isLoading={mutation.isPending} onClick={() => void apply()}>
              Confirmer
            </Button>
            <Button onClick={() => setIsConfirming(false)} variant="ghost">
              Annuler
            </Button>
          </div>
        </Card>
      ) : (
        <Button onClick={() => setIsConfirming(true)} variant="secondary">
          {nextVisibility === 'PUBLIC'
            ? 'Rendre visible par les membres'
            : 'Rendre privé'}
        </Button>
      )}
      {success ? (
        <p class="text-sm text-emerald-200" role="status">
          Visibilité mise à jour.
        </p>
      ) : null}
      {mutation.error ? (
        <ErrorState description={getMutationError(mutation.error)} />
      ) : null}
    </section>
  );
}

function isValidPosition(value: string): boolean {
  if (value.trim() === '') return false;
  const position = Number(value);
  return Number.isInteger(position) && position >= 0 && position <= 10_000;
}

function ModuleEditor({ module }: { module: AdminModuleSummary }) {
  const mutation = useAdminCurriculumMutation();
  const [title, setTitle] = useState(module.title);
  const [description, setDescription] = useState(module.description);
  const [position, setPosition] = useState(String(module.position));
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaved(false);
    try {
      await mutation.updateModule(module.id, {
        description: description.trim(),
        position: Number(position),
        title: title.trim(),
      });
      setSaved(true);
    } catch {
      // Le message accessible ci-dessous présente l’erreur.
    }
  }

  return (
    <div class="space-y-6">
      <section class="space-y-4" aria-labelledby="module-details-title">
        <h3 class="font-semibold" id="module-details-title">
          Détails du module
        </h3>
        <TextField
          label="Titre du module"
          maxLength={200}
          onInput={(event) => setTitle(event.currentTarget.value)}
          value={title}
        />
        <Textarea
          label="Résumé du module"
          maxLength={5_000}
          onInput={(event) => setDescription(event.currentTarget.value)}
          value={description}
        />
        <TextField
          label="Ordre du module"
          min={0}
          max={10_000}
          onInput={(event) => setPosition(event.currentTarget.value)}
          type="number"
          value={position}
        />
        <Button
          disabled={
            !title.trim() || !description.trim() || !isValidPosition(position)
          }
          isLoading={mutation.isPending}
          onClick={() => void save()}
          variant="secondary"
        >
          Enregistrer le module
        </Button>
        {saved ? (
          <p class="text-sm text-emerald-200" role="status">
            Module enregistré.
          </p>
        ) : null}
        {mutation.error ? (
          <ErrorState description={getMutationError(mutation.error)} />
        ) : null}
      </section>
      <PublicationAction
        isPublished={module.isPublished}
        targetId={module.id}
        targetTitle={module.title}
        targetType="MODULE"
      />
    </div>
  );
}

function LessonEditor({ lesson }: { lesson: AdminLessonSummary }) {
  const mutation = useAdminCurriculumMutation();
  const [title, setTitle] = useState(lesson.title);
  const [summary, setSummary] = useState(lesson.summary);
  const [position, setPosition] = useState(String(lesson.position));
  const [confirmPublication, setConfirmPublication] = useState(false);
  const [message, setMessage] = useState<string>();

  async function save() {
    setMessage(undefined);
    try {
      await mutation.updateLesson(lesson.id, {
        position: Number(position),
        summary: summary.trim(),
        title: title.trim(),
      });
      setMessage('Leçon enregistrée.');
    } catch {
      // Le message accessible ci-dessous présente l’erreur.
    }
  }

  async function togglePublication() {
    setMessage(undefined);
    try {
      await mutation.updateLesson(lesson.id, {
        isPublished: !lesson.isPublished,
      });
      setConfirmPublication(false);
      setMessage(lesson.isPublished ? 'Leçon dépubliée.' : 'Leçon publiée.');
    } catch {
      // Le message accessible ci-dessous présente l’erreur.
    }
  }

  return (
    <div class="space-y-6">
      <section class="space-y-4" aria-labelledby="lesson-details-title">
        <h3 class="font-semibold" id="lesson-details-title">
          Détails de la leçon
        </h3>
        <TextField
          label="Titre de la leçon"
          maxLength={200}
          onInput={(event) => setTitle(event.currentTarget.value)}
          value={title}
        />
        <Textarea
          label="Résumé de la leçon"
          maxLength={5_000}
          onInput={(event) => setSummary(event.currentTarget.value)}
          value={summary}
        />
        <TextField
          label="Ordre de la leçon"
          min={0}
          max={10_000}
          onInput={(event) => setPosition(event.currentTarget.value)}
          type="number"
          value={position}
        />
        <Button
          disabled={
            !title.trim() || !summary.trim() || !isValidPosition(position)
          }
          isLoading={mutation.isPending}
          onClick={() => void save()}
          variant="secondary"
        >
          Enregistrer la leçon
        </Button>
      </section>
      <section class="space-y-3" aria-labelledby="lesson-publication-title">
        <h3 class="font-semibold" id="lesson-publication-title">
          Publication
        </h3>
        {!confirmPublication ? (
          <Button
            onClick={() => setConfirmPublication(true)}
            variant={lesson.isPublished ? 'danger' : 'primary'}
          >
            Prévisualiser — {lesson.isPublished ? 'dépublier' : 'publier'} la
            leçon
          </Button>
        ) : (
          <Card class="space-y-3 bg-slate-900" role="region">
            <p class="text-sm text-slate-200">
              La leçon « {lesson.title} » sera{' '}
              {lesson.isPublished ? 'dépubliée' : 'publiée'}.
            </p>
            <div class="flex flex-wrap gap-3">
              <Button
                isLoading={mutation.isPending}
                onClick={() => void togglePublication()}
                variant={lesson.isPublished ? 'danger' : 'primary'}
              >
                Confirmer
              </Button>
              <Button
                onClick={() => setConfirmPublication(false)}
                variant="ghost"
              >
                Annuler
              </Button>
            </div>
          </Card>
        )}
      </section>
      {message ? (
        <p class="text-sm text-emerald-200" role="status">
          {message}
        </p>
      ) : null}
      {mutation.error ? (
        <ErrorState description={getMutationError(mutation.error)} />
      ) : null}
    </div>
  );
}

function ManagementDrawer({
  children,
  title,
}: {
  children: ComponentChildren;
  title: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
        elementRef={triggerRef}
        variant="secondary"
      >
        Gérer ce contenu
      </Button>
      <Drawer
        isOpen={isOpen}
        onDismiss={() => setIsOpen(false)}
        returnFocusElement={triggerRef.current}
        title={title}
      >
        {children}
      </Drawer>
    </>
  );
}

function EntityCard({
  href,
  position,
  status,
  title,
}: {
  href: string;
  position: number;
  status: ComponentChildren;
  title: string;
}) {
  return (
    <li>
      <Card class="space-y-3">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Position {position}
            </p>
            <h3 class="mt-1 text-lg font-semibold">{title}</h3>
          </div>
          {status}
        </div>
        <NavigationAction href={href} variant="secondary">
          Ouvrir
        </NavigationAction>
      </Card>
    </li>
  );
}

function childList(
  title: string,
  children: ComponentChildren,
  isEmpty: boolean,
) {
  return (
    <section aria-labelledby="admin-children-title" class="space-y-4">
      <h2 class="text-xl font-semibold" id="admin-children-title">
        {title}
      </h2>
      {isEmpty ? (
        <EmptyState
          description="Ajoutez d’abord un contenu enfant à ce niveau."
          title="Aucun contenu"
        />
      ) : (
        <ul class="space-y-4">{children}</ul>
      )}
    </section>
  );
}

function programPath(programId: string) {
  return `/admin/program/${encodeURIComponent(programId)}`;
}

function stagePath(programId: string, stageId: string) {
  return `${programPath(programId)}/stage/${encodeURIComponent(stageId)}`;
}

function modulePath(programId: string, stageId: string, moduleId: string) {
  return `${stagePath(programId, stageId)}/module/${encodeURIComponent(moduleId)}`;
}

function lessonPath(
  programId: string,
  stageId: string,
  moduleId: string,
  lessonId: string,
) {
  return `${modulePath(programId, stageId, moduleId)}/lesson/${encodeURIComponent(lessonId)}`;
}

function ProgramsView({ programs }: { programs: AdminProgramSummary[] }) {
  return (
    <>
      <Breadcrumbs items={[{ label: 'Administration' }]} />
      <h1 class="text-3xl font-bold tracking-tight">Administration</h1>
      <Card class="space-y-3">
        <h2 class="text-xl font-semibold">Demandes d’accès</h2>
        <p class="leading-7 text-slate-300">
          Examinez les demandes dont l’adresse e-mail a été vérifiée.
        </p>
        <NavigationAction href="/admin/access-requests" variant="secondary">
          Gérer les demandes
        </NavigationAction>
      </Card>
      <Card class="space-y-3">
        <h2 class="text-xl font-semibold">Comptes utilisateurs</h2>
        <p class="leading-7 text-slate-300">
          Suspendez un accès, révoquez ses sessions ou réactivez un compte.
        </p>
        <NavigationAction href="/admin/accounts" variant="secondary">
          Gérer les comptes
        </NavigationAction>
      </Card>
      <h2 class="text-xl font-semibold">Programmes</h2>
      {programs.length === 0 ? (
        <EmptyState
          description="Créez d’abord un programme pour administrer son contenu."
          title="Aucun contenu administrable"
        />
      ) : (
        <ul class="space-y-4">
          {programs.map((program) => (
            <EntityCard
              href={programPath(program.id)}
              key={program.id}
              position={program.position}
              status={<ProgramStatusBadge status={program.status} />}
              title={program.title}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function ProgramView({ program }: { program: AdminProgram }) {
  const isPublished = program.status === 'ACTIVE';

  return (
    <>
      <Breadcrumbs
        items={[
          { href: '/admin', label: 'Administration' },
          { label: program.title },
        ]}
      />
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-3xl font-bold tracking-tight">{program.title}</h1>
        <ProgramStatusBadge status={program.status} />
      </div>
      <p class="text-sm text-slate-300">
        {program.publishedVersion
          ? `Version publiée : v${program.publishedVersion.version} — ${new Date(
              program.publishedVersion.publishedAt,
            ).toLocaleDateString('fr-FR')}`
          : 'Aucune version publiée enregistrée.'}
      </p>
      <ManagementDrawer title={`Gérer ${program.title}`}>
        <ProgramVisibilityAction program={program} />
        <PublicationAction
          isPublished={isPublished}
          targetId={program.id}
          targetTitle={program.title}
          targetType="PROGRAM"
        />
      </ManagementDrawer>
      {childList(
        'Étapes',
        program.stages.map((stage) => (
          <EntityCard
            href={stagePath(program.id, stage.id)}
            key={stage.id}
            position={stage.position}
            status={<StatusBadge isPublished={stage.isPublished} />}
            title={stage.title}
          />
        )),
        program.stages.length === 0,
      )}
    </>
  );
}

function StageView({ stage }: { stage: AdminStage }) {
  return (
    <>
      <Breadcrumbs
        items={[
          { href: '/admin', label: 'Administration' },
          { href: programPath(stage.program.id), label: stage.program.title },
          { label: stage.title },
        ]}
      />
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-3xl font-bold tracking-tight">{stage.title}</h1>
        <StatusBadge isPublished={stage.isPublished} />
      </div>
      <ManagementDrawer title={`Gérer ${stage.title}`}>
        <PublicationAction
          isPublished={stage.isPublished}
          targetId={stage.id}
          targetTitle={stage.title}
          targetType="STAGE"
        />
      </ManagementDrawer>
      {childList(
        'Modules',
        stage.modules.map((module) => (
          <EntityCard
            href={modulePath(stage.program.id, stage.id, module.id)}
            key={module.id}
            position={module.position}
            status={<StatusBadge isPublished={module.isPublished} />}
            title={module.title}
          />
        )),
        stage.modules.length === 0,
      )}
    </>
  );
}

function ModuleView({ module }: { module: AdminModule }) {
  return (
    <>
      <Breadcrumbs
        items={[
          { href: '/admin', label: 'Administration' },
          {
            href: programPath(module.stage.program.id),
            label: module.stage.program.title,
          },
          {
            href: stagePath(module.stage.program.id, module.stage.id),
            label: module.stage.title,
          },
          { label: module.title },
        ]}
      />
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-3xl font-bold tracking-tight">{module.title}</h1>
        <StatusBadge isPublished={module.isPublished} />
      </div>
      <ManagementDrawer title={`Gérer ${module.title}`}>
        <ModuleEditor module={module} />
      </ManagementDrawer>
      {childList(
        'Leçons',
        module.lessons.map((lesson) => (
          <EntityCard
            href={lessonPath(
              module.stage.program.id,
              module.stage.id,
              module.id,
              lesson.id,
            )}
            key={lesson.id}
            position={lesson.position}
            status={<StatusBadge isPublished={lesson.isPublished} />}
            title={lesson.title}
          />
        )),
        module.lessons.length === 0,
      )}
    </>
  );
}

function LessonView({ lesson }: { lesson: AdminLesson }) {
  const { module } = lesson;

  return (
    <>
      <Breadcrumbs
        items={[
          { href: '/admin', label: 'Administration' },
          {
            href: programPath(module.stage.program.id),
            label: module.stage.program.title,
          },
          {
            href: stagePath(module.stage.program.id, module.stage.id),
            label: module.stage.title,
          },
          {
            href: modulePath(
              module.stage.program.id,
              module.stage.id,
              module.id,
            ),
            label: module.title,
          },
          { label: lesson.title },
        ]}
      />
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-3xl font-bold tracking-tight">{lesson.title}</h1>
        <StatusBadge isPublished={lesson.isPublished} />
      </div>
      <Card class="space-y-3">
        <p class="leading-7 text-slate-300">{lesson.summary}</p>
        <p class="text-sm text-slate-400">Position {lesson.position}</p>
      </Card>
      <ManagementDrawer title={`Gérer ${lesson.title}`}>
        <LessonEditor lesson={lesson} />
      </ManagementDrawer>
    </>
  );
}

function navigationTarget({
  lessonId,
  moduleId,
  programId,
  stageId,
}: AdminPageProps): AdminNavigationTarget {
  if (lessonId) return { id: lessonId, kind: 'LESSON' };
  if (moduleId) return { id: moduleId, kind: 'MODULE' };
  if (stageId) return { id: stageId, kind: 'STAGE' };
  if (programId) return { id: programId, kind: 'PROGRAM' };
  return { kind: 'PROGRAMS' };
}

function NavigationView({ data }: { data: AdminNavigationResponse }) {
  if (data.kind === 'PROGRAMS')
    return <ProgramsView programs={data.programs} />;
  if (data.kind === 'PROGRAM') return <ProgramView program={data.program} />;
  if (data.kind === 'STAGE') return <StageView stage={data.stage} />;
  if (data.kind === 'MODULE') return <ModuleView module={data.module} />;
  return <LessonView lesson={data.lesson} />;
}

export function AdminPage(props: AdminPageProps) {
  const query = useAdminNavigationQuery(navigationTarget(props));

  if (query.isPending)
    return <Skeleton label="Chargement de l’administration" />;
  if (query.error || !query.data) {
    return (
      <ErrorState description="Les contenus administrables n’ont pas pu être chargés." />
    );
  }

  return (
    <section aria-label="Administration" class="page-shell">
      <header class="space-y-2">
        <p class="text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">
          Zone sécurisée
        </p>
        <p class="leading-7 text-slate-300">
          Parcourez un niveau à la fois et ouvrez son panneau de gestion.
        </p>
      </header>
      <NavigationView data={query.data} />
    </section>
  );
}
