import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';

import {
  type BackNavigationTarget,
  useBackNavigationTarget,
} from '@/components/layout/BackNavigationContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { Section } from '@/components/ui/Section';
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
import {
  adminLessonHref,
  adminModuleHref,
  adminProgramHref,
  adminStageHref,
} from '@/lib/admin-navigation';
import { ApiClientError } from '@/lib/api-client';
import { useI18n } from '@/i18n';
import type { MessageKey } from '@/i18n/catalogs';
import { formatLocalizedDate } from '@/shared/locale';

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
  const { t } = useI18n();
  return (
    <Badge tone={isPublished ? 'success' : 'warning'}>
      {t(isPublished ? 'common.published' : 'common.draft')}
    </Badge>
  );
}

function ProgramStatusBadge({
  status,
}: {
  status: AdminProgramSummary['status'];
}) {
  const { t } = useI18n();
  if (status === 'ARCHIVED') return <Badge>{t('admin.archived')}</Badge>;

  return <StatusBadge isPublished={status === 'ACTIVE'} />;
}

function VisibilityBadge({
  visibility,
}: {
  visibility: AdminProgramSummary['visibility'];
}) {
  const { t } = useI18n();
  return (
    <Badge tone={visibility === 'PUBLIC' ? 'success' : 'warning'}>
      {t(visibility === 'PUBLIC' ? 'admin.visibleMembers' : 'programs.private')}
    </Badge>
  );
}

function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const { t } = useI18n();
  return (
    <nav aria-label={t('admin.breadcrumb')}>
      <ol class="ui-text-muted flex flex-wrap items-center gap-2 text-sm">
        {items.map((item, index) => (
          <li class="flex items-center gap-2" key={`${item.label}-${index}`}>
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <a
                class="ui-link inline-flex min-h-11 items-center rounded-[var(--radius-control)]"
                href={item.href}
              >
                {item.label}
              </a>
            ) : (
              <span aria-current="page" class="ui-text">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

type Translate = (
  key: MessageKey,
  parameters?: Record<string, string | number>,
) => string;

function getMutationError(error: unknown, t: Translate): string {
  if (
    error instanceof ApiClientError &&
    error.code === 'PUBLICATION_PLAN_STALE'
  ) {
    return t('admin.mutation.stale');
  }
  if (error instanceof ApiClientError && error.code === 'PUBLICATION_BLOCKED') {
    return t('admin.mutation.blocked');
  }
  if (error instanceof ApiClientError && error.code === 'LESSON_NOT_READY') {
    return t('admin.mutation.lessonNotReady');
  }

  return t('admin.mutation.error');
}

function changeLabel(
  change: PublicationPlan['changes'][number],
  t: Translate,
): string {
  const verb =
    change.to === true || change.to === 'ACTIVE'
      ? t('admin.publish')
      : t('admin.unpublish');
  const typeKey = (
    {
      LESSON: 'admin.change.lesson',
      MODULE: 'admin.change.module',
      PROGRAM: 'admin.change.program',
      STAGE: 'admin.change.stage',
    } as const
  )[change.type];

  return t('admin.change.label', {
    action: verb,
    title: change.title,
    type: t(typeKey),
  });
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
  const { t } = useI18n();
  const mutation = useAdminCurriculumMutation();
  const [mode, setMode] = useState<PublicationMode>('PARENT_ONLY');
  const [plan, setPlan] = useState<PublicationPlan>();
  const [success, setSuccess] = useState<string>();
  const action = isPublished ? 'UNPUBLISH' : 'PUBLISH';
  const effectiveMode = action === 'PUBLISH' ? 'FULL' : mode;
  const actionLabel = t(isPublished ? 'admin.unpublish' : 'admin.publish');
  const actionLabelLower = actionLabel.toLocaleLowerCase();

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
      setSuccess(t('admin.publication.success', { action: actionLabel }));
    } catch {
      // L’erreur normalisée est annoncée dans la zone de confirmation.
    }
  }

  return (
    <section aria-labelledby={`publication-${targetId}`} class="space-y-3">
      <h3 class="font-semibold" id={`publication-${targetId}`}>
        {t('admin.publication.title', { title: targetTitle })}
      </h3>
      {isPublished ? (
        <fieldset class="space-y-2 text-sm">
          <legend class="ui-text font-medium">
            {t('admin.publication.scope')}
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
            {t('admin.publication.parentOnly')}
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
            {t('admin.publication.full')}
          </label>
        </fieldset>
      ) : null}
      <Button
        isLoading={mutation.isPending && !plan}
        onClick={() => void preview()}
        size="sm"
        variant={isPublished ? 'danger' : 'primary'}
      >
        {t('admin.publication.preview', { action: actionLabelLower })}
      </Button>
      {success ? (
        <p class="text-sm text-[var(--color-success)]" role="status">
          {success}
        </p>
      ) : null}
      {plan ? (
        <Card aria-live="polite" class="space-y-4" tone="muted" role="region">
          <h4 class="font-medium">{t('admin.publication.previewTitle')}</h4>
          <p class="ui-text-muted text-sm">
            {plan.changes.length === 0
              ? t('admin.publication.noChanges')
              : t('admin.publication.changeCount', {
                  count: plan.changes.length,
                })}
          </p>
          {plan.changes.length > 0 ? (
            <ul class="ui-text-muted list-disc space-y-1 pl-5 text-sm">
              {plan.changes.map((change) => (
                <li key={`${change.type}-${change.id}`}>
                  {changeLabel(change, t)}
                </li>
              ))}
            </ul>
          ) : null}
          {plan.warnings.map((warning) => (
            <p class="ui-text-warning text-sm" key={warning}>
              {warning}
            </p>
          ))}
          {plan.blockers.length > 0 ? (
            <div class="space-y-2" role="alert">
              <p class="ui-text-danger font-medium">
                {t('admin.publication.impossible')}
              </p>
              <ul class="ui-text-danger list-disc space-y-1 pl-5 text-sm">
                {plan.blockers.map((blocker) => (
                  <li key={`${blocker.code}-${blocker.id}`}>
                    {blocker.title} — {blocker.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {mutation.error ? (
            <ErrorState description={getMutationError(mutation.error, t)} />
          ) : null}
          <div class="flex flex-wrap gap-3">
            <Button
              disabled={plan.blockers.length > 0}
              isLoading={mutation.isPending}
              onClick={() => void apply()}
              variant={isPublished ? 'danger' : 'primary'}
            >
              {t('admin.publication.confirm', { action: actionLabelLower })}
            </Button>
            <Button onClick={() => setPlan(undefined)} variant="ghost">
              {t('common.cancel')}
            </Button>
          </div>
        </Card>
      ) : mutation.error ? (
        <ErrorState description={getMutationError(mutation.error, t)} />
      ) : null}
    </section>
  );
}

function ProgramVisibilityAction({ program }: { program: AdminProgram }) {
  const { t } = useI18n();
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
          {t('admin.visibility.title')}
        </h3>
        <VisibilityBadge visibility={program.visibility} />
      </div>
      <p class="ui-text-muted text-sm leading-6">
        {t('admin.visibility.description')}
      </p>
      {isConfirming ? (
        <Card class="space-y-3" tone="muted" role="alertdialog">
          <p class="ui-text text-sm">
            {nextVisibility === 'PUBLIC'
              ? t('admin.visibility.makePublicQuestion')
              : t('admin.visibility.makePrivateQuestion')}
          </p>
          <div class="flex flex-wrap gap-3">
            <Button isLoading={mutation.isPending} onClick={() => void apply()}>
              {t('common.confirm')}
            </Button>
            <Button onClick={() => setIsConfirming(false)} variant="ghost">
              {t('common.cancel')}
            </Button>
          </div>
        </Card>
      ) : (
        <Button onClick={() => setIsConfirming(true)} variant="secondary">
          {nextVisibility === 'PUBLIC'
            ? t('admin.visibility.makePublic')
            : t('admin.visibility.makePrivate')}
        </Button>
      )}
      {success ? (
        <p class="text-sm text-[var(--color-success)]" role="status">
          {t('admin.visibility.saved')}
        </p>
      ) : null}
      {mutation.error ? (
        <ErrorState description={getMutationError(mutation.error, t)} />
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
  const { t } = useI18n();
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
          {t('admin.module.details')}
        </h3>
        <TextField
          label={t('admin.module.title')}
          maxLength={200}
          onInput={(event) => setTitle(event.currentTarget.value)}
          value={title}
        />
        <Textarea
          label={t('admin.module.summary')}
          maxLength={5_000}
          onInput={(event) => setDescription(event.currentTarget.value)}
          value={description}
        />
        <TextField
          label={t('admin.module.position')}
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
          {t('admin.module.save')}
        </Button>
        {saved ? (
          <p class="text-sm text-[var(--color-success)]" role="status">
            {t('admin.module.saved')}
          </p>
        ) : null}
        {mutation.error ? (
          <ErrorState description={getMutationError(mutation.error, t)} />
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
  const { t } = useI18n();
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
      setMessage(t('admin.lesson.saved'));
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
      setMessage(
        t(
          lesson.isPublished
            ? 'admin.lesson.unpublished'
            : 'admin.lesson.published',
        ),
      );
    } catch {
      // Le message accessible ci-dessous présente l’erreur.
    }
  }

  return (
    <div class="space-y-6">
      <section class="space-y-4" aria-labelledby="lesson-details-title">
        <h3 class="font-semibold" id="lesson-details-title">
          {t('admin.lesson.details')}
        </h3>
        <TextField
          label={t('admin.lesson.title')}
          maxLength={200}
          onInput={(event) => setTitle(event.currentTarget.value)}
          value={title}
        />
        <Textarea
          label={t('admin.lesson.summary')}
          maxLength={5_000}
          onInput={(event) => setSummary(event.currentTarget.value)}
          value={summary}
        />
        <TextField
          label={t('admin.lesson.position')}
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
          {t('admin.lesson.save')}
        </Button>
      </section>
      <section class="space-y-3" aria-labelledby="lesson-publication-title">
        <h3 class="font-semibold" id="lesson-publication-title">
          {t('admin.lesson.publication')}
        </h3>
        {!confirmPublication ? (
          <Button
            onClick={() => setConfirmPublication(true)}
            variant={lesson.isPublished ? 'danger' : 'primary'}
          >
            {t('admin.lesson.previewAction', {
              action: t(
                lesson.isPublished ? 'admin.unpublish' : 'admin.publish',
              ).toLocaleLowerCase(),
            })}
          </Button>
        ) : (
          <Card class="space-y-3" tone="muted" role="region">
            <p class="ui-text text-sm">
              {t('admin.lesson.confirmAction', {
                action: t(
                  lesson.isPublished ? 'admin.unpublish' : 'admin.publish',
                ).toLocaleLowerCase(),
                title: lesson.title,
              })}
            </p>
            <div class="flex flex-wrap gap-3">
              <Button
                isLoading={mutation.isPending}
                onClick={() => void togglePublication()}
                variant={lesson.isPublished ? 'danger' : 'primary'}
              >
                {t('common.confirm')}
              </Button>
              <Button
                onClick={() => setConfirmPublication(false)}
                variant="ghost"
              >
                {t('common.cancel')}
              </Button>
            </div>
          </Card>
        )}
      </section>
      {message ? (
        <p class="text-sm text-[var(--color-success)]" role="status">
          {message}
        </p>
      ) : null}
      {mutation.error ? (
        <ErrorState description={getMutationError(mutation.error, t)} />
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
  const { t } = useI18n();
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
        {t('admin.manageContent')}
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
  const { t } = useI18n();
  return (
    <li>
      <ListRow
        aside={
          <NavigationAction href={href} variant="secondary">
            {t('admin.open')}
          </NavigationAction>
        }
        class="items-start"
      >
        <div class="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="ui-text-muted text-xs font-semibold tracking-wide uppercase">
              {t('admin.position', { position })}
            </p>
            <h3 class="mt-1 break-words text-lg font-semibold">{title}</h3>
          </div>
          {status}
        </div>
      </ListRow>
    </li>
  );
}

function childList(
  title: string,
  children: ComponentChildren,
  isEmpty: boolean,
) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="admin-children-title" class="space-y-4">
      <h2 class="text-xl font-semibold" id="admin-children-title">
        {title}
      </h2>
      {isEmpty ? (
        <EmptyState
          description={t('admin.emptyChild.description')}
          title={t('admin.emptyChild.title')}
        />
      ) : (
        <ul class="ui-list">{children}</ul>
      )}
    </section>
  );
}

function ProgramsView({ programs }: { programs: AdminProgramSummary[] }) {
  const { t } = useI18n();
  return (
    <>
      <Breadcrumbs items={[{ label: t('admin.title') }]} />
      <h1 class="text-3xl font-bold tracking-tight">{t('admin.title')}</h1>
      <Section class="space-y-3">
        <h2 class="text-xl font-semibold">{t('admin.requests.title')}</h2>
        <p class="ui-text-muted leading-7">{t('admin.accessDescription')}</p>
        <NavigationAction href="/admin/access-requests" variant="secondary">
          {t('admin.requests')}
        </NavigationAction>
      </Section>
      <Section class="space-y-3">
        <h2 class="text-xl font-semibold">{t('admin.accounts.title')}</h2>
        <p class="ui-text-muted leading-7">{t('admin.accountsDescription')}</p>
        <NavigationAction href="/admin/accounts" variant="secondary">
          {t('admin.accounts')}
        </NavigationAction>
      </Section>
      <Section class="space-y-3">
        <h2 class="text-xl font-medium">{t('admin.credits.title')}</h2>
        <p class="ui-text-muted leading-7">
          {t('admin.credits.description')}
        </p>
        <NavigationAction href="/admin/credits" variant="secondary">
          {t('admin.credits.open')}
        </NavigationAction>
      </Section>
      <Section class="space-y-3">
        <h2 class="text-xl font-medium">{t('admin.contacts.title')}</h2>
        <p class="ui-text-muted leading-7">
          {t('admin.contacts.description')}
        </p>
        <NavigationAction href="/admin/contacts" variant="secondary">
          {t('admin.contacts.open')}
        </NavigationAction>
      </Section>
      <h2 class="text-xl font-semibold">{t('admin.programs')}</h2>
      {programs.length === 0 ? (
        <EmptyState
          description={t('admin.empty.description')}
          title={t('admin.empty.title')}
        />
      ) : (
        <ul class="ui-list">
          {programs.map((program) => (
            <EntityCard
              href={adminProgramHref(program.id)}
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
  const { locale, t } = useI18n();
  const isPublished = program.status === 'ACTIVE';

  return (
    <>
      <Breadcrumbs
        items={[
          { href: '/admin', label: t('admin.title') },
          { label: program.title },
        ]}
      />
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-3xl font-bold tracking-tight">{program.title}</h1>
        <ProgramStatusBadge status={program.status} />
      </div>
      <p class="ui-text-muted text-sm">
        {program.publishedVersion
          ? t('admin.publishedVersion', {
              date: formatLocalizedDate(
                program.publishedVersion.publishedAt,
                locale,
                { dateStyle: 'medium' },
              ),
              version: program.publishedVersion.version,
            })
          : t('admin.noPublishedVersion')}
      </p>
      <ManagementDrawer title={t('admin.manage', { title: program.title })}>
        <ProgramVisibilityAction program={program} />
        <PublicationAction
          isPublished={isPublished}
          targetId={program.id}
          targetTitle={program.title}
          targetType="PROGRAM"
        />
      </ManagementDrawer>
      {childList(
        t('admin.stages'),
        program.stages.map((stage) => (
          <EntityCard
            href={adminStageHref(program.id, stage.id)}
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
  const { t } = useI18n();
  return (
    <>
      <Breadcrumbs
        items={[
          { href: '/admin', label: t('admin.title') },
          {
            href: adminProgramHref(stage.program.id),
            label: stage.program.title,
          },
          { label: stage.title },
        ]}
      />
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-3xl font-bold tracking-tight">{stage.title}</h1>
        <StatusBadge isPublished={stage.isPublished} />
      </div>
      <ManagementDrawer title={t('admin.manage', { title: stage.title })}>
        <PublicationAction
          isPublished={stage.isPublished}
          targetId={stage.id}
          targetTitle={stage.title}
          targetType="STAGE"
        />
      </ManagementDrawer>
      {childList(
        t('admin.modules'),
        stage.modules.map((module) => (
          <EntityCard
            href={adminModuleHref(stage.program.id, stage.id, module.id)}
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
  const { t } = useI18n();
  return (
    <>
      <Breadcrumbs
        items={[
          { href: '/admin', label: t('admin.title') },
          {
            href: adminProgramHref(module.stage.program.id),
            label: module.stage.program.title,
          },
          {
            href: adminStageHref(module.stage.program.id, module.stage.id),
            label: module.stage.title,
          },
          { label: module.title },
        ]}
      />
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-3xl font-bold tracking-tight">{module.title}</h1>
        <StatusBadge isPublished={module.isPublished} />
      </div>
      <ManagementDrawer title={t('admin.manage', { title: module.title })}>
        <ModuleEditor module={module} />
      </ManagementDrawer>
      {childList(
        t('admin.lessons'),
        module.lessons.map((lesson) => (
          <EntityCard
            href={adminLessonHref(
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
  const { t } = useI18n();

  return (
    <>
      <Breadcrumbs
        items={[
          { href: '/admin', label: t('admin.title') },
          {
            href: adminProgramHref(module.stage.program.id),
            label: module.stage.program.title,
          },
          {
            href: adminStageHref(module.stage.program.id, module.stage.id),
            label: module.stage.title,
          },
          {
            href: adminModuleHref(
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
      <Section class="space-y-3">
        <p class="ui-text-muted leading-7">{lesson.summary}</p>
        <p class="ui-text-muted text-sm">
          {t('admin.position', { position: lesson.position })}
        </p>
      </Section>
      <ManagementDrawer title={t('admin.manage', { title: lesson.title })}>
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

function adminBackTarget({
  lessonId,
  moduleId,
  programId,
  stageId,
}: AdminPageProps): BackNavigationTarget | null {
  if (lessonId && moduleId && programId && stageId) {
    return {
      href: adminModuleHref(programId, stageId, moduleId),
      labelKey: 'navigation.back.adminModule',
    };
  }
  if (moduleId && programId && stageId) {
    return {
      href: adminStageHref(programId, stageId),
      labelKey: 'navigation.back.adminStage',
    };
  }
  if (stageId && programId) {
    return {
      href: adminProgramHref(programId),
      labelKey: 'navigation.back.adminProgram',
    };
  }
  if (programId) {
    return { href: '/admin', labelKey: 'navigation.back.admin' };
  }
  return { href: '/profile', labelKey: 'navigation.back.profile' };
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
  useBackNavigationTarget(adminBackTarget(props));
  const query = useAdminNavigationQuery(navigationTarget(props));
  const { t } = useI18n();

  if (query.isPending) return <Skeleton label={t('admin.loading')} />;
  if (query.error || !query.data) {
    return <ErrorState description={t('admin.loadError')} />;
  }

  return (
    <section
      aria-label={t('admin.title')}
      class="page-layout page-layout--admin page-shell"
    >
      <header class="page-header space-y-2">
        <p class="page-eyebrow">{t('admin.eyebrow')}</p>
        <p class="page-description mt-0">{t('admin.description')}</p>
      </header>
      <NavigationView data={query.data} />
    </section>
  );
}
