import { route } from 'preact-router';
import { useEffect, useRef, useState } from 'preact/hooks';

import { useBackNavigationTarget } from '@/components/layout/BackNavigationContext';
import { ProductPageHeader } from '@/components/product/ProductPageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { SafeMarkdown } from '@/components/ui/SafeMarkdown';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { Textarea } from '@/components/ui/Textarea';
import { TextField } from '@/components/ui/TextField';
import {
  type NoteDetail,
  useNoteMutation,
  useNoteQuery,
  useNotesQuery,
} from '@/features/notes/queries';
import { useI18n, type UiLocale } from '@/i18n';
import { formatLocalizedDate } from '@/shared/locale';

function formatUpdatedAt(value: string, locale: UiLocale): string {
  return formatLocalizedDate(value, locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getExcerpt(markdown: string, emptyLabel: string): string {
  const normalized = markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/^(?:[-+*]|\d+\.)\s+/gm, '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return emptyLabel;

  return normalized.length > 140 ? `${normalized.slice(0, 137)}…` : normalized;
}

function NoteCard({ note }: { note: NoteDetail }) {
  const { locale, t } = useI18n();
  return (
    <li>
      <article class="totem-product-row totem-note-row">
        <div class="totem-product-row__content space-y-2">
          <div class="flex items-start justify-between gap-3">
            <h2 class="font-semibold">{note.title}</h2>
            {note.lesson ? (
              <Badge tone="neutral">{t('notes.linkedLesson')}</Badge>
            ) : null}
          </div>
          <p class="text-sm leading-6 text-[var(--color-text)]">
            {getExcerpt(note.markdown, t('notes.emptyExcerpt'))}
          </p>
          {note.lesson ? (
            <p class="text-sm text-[var(--color-text-muted)]">
              {note.program?.title ? `${note.program.title} · ` : ''}
              {note.lesson.title}
            </p>
          ) : (
            <p class="text-sm text-[var(--color-text-muted)]">
              {t('notes.personal')}
            </p>
          )}
          <p class="text-xs text-[var(--color-text-muted)]">
            {t('notes.updatedAt', {
              date: formatUpdatedAt(note.updatedAt, locale),
            })}
          </p>
        </div>
        <NavigationAction
          class="totem-product-row__action"
          href={`/notes/${encodeURIComponent(note.id)}`}
          variant="ghost"
        >
          {t('notes.edit')}
        </NavigationAction>
      </article>
    </li>
  );
}

export function NotesPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const query = useNotesQuery(debouncedSearch);
  const mutation = useNoteMutation();
  const { t } = useI18n();

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 300);

    return () => window.clearTimeout(timeout);
  }, [search]);

  async function createNote() {
    try {
      const note = await mutation.create();
      void route(`/notes/${encodeURIComponent(note.id)}`);
    } catch {
      // L’erreur normalisée est affichée dans la page.
    }
  }

  return (
    <section
      aria-labelledby="notes-title"
      class="page-layout page-layout--work page-shell"
    >
      <ProductPageHeader
        description={t('notes.description')}
        eyebrow={t('notes.eyebrow')}
        id="notes-title"
        summary={
          query.data
            ? {
                description: t('notes.summary.description'),
                eyebrow: t('notes.summary.eyebrow'),
                facts: [
                  {
                    label: t('notes.summary.linked'),
                    value: query.data.notes.filter((note) => note.lesson).length,
                  },
                  {
                    label: t('notes.summary.personal'),
                    value: query.data.notes.filter((note) => !note.lesson).length,
                  },
                ],
                title:
                  query.data.notes.length === 1
                    ? t('notes.summary.one')
                    : t('notes.summary.count', {
                        count: query.data.notes.length,
                      }),
              }
            : undefined
        }
        title={t('notes.title')}
      />

      <div class="totem-notes-tools">
        <TextField
          label={t('notes.search')}
          onInput={(event) => setSearch(event.currentTarget.value)}
          placeholder={t('notes.searchPlaceholder')}
          type="search"
          value={search}
        />
        <Button
          class="w-full md:w-auto"
          isLoading={mutation.isPending}
          onClick={() => void createNote()}
          size="lg"
        >
          {t('notes.new')}
        </Button>
      </div>

      {mutation.error ? (
        <ErrorState description={t('notes.createError')} />
      ) : null}
      {query.isPending ? <Skeleton label={t('notes.loading')} /> : null}
      {query.error ? <ErrorState description={t('notes.loadError')} /> : null}
      {!query.isPending && !query.error && query.data?.notes.length === 0 ? (
        <EmptyState
          description={
            debouncedSearch
              ? t('notes.noResults.description')
              : t('notes.empty.description')
          }
          title={
            debouncedSearch
              ? t('notes.noResults.title')
              : t('notes.empty.title')
          }
        />
      ) : null}
      {query.data?.notes.length ? (
        <div class="space-y-4">
          <div class="totem-notes-workspace">
            <ul class="totem-product-rows">
              {query.data.notes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </ul>
            <article class="totem-note-preview">
              <p class="totem-kicker">
                {query.data.notes[0]?.lesson
                  ? t('notes.linkedLesson')
                  : t('notes.personal')}
              </p>
              <h2>{query.data.notes[0]?.title}</h2>
              <p>
                {getExcerpt(
                  query.data.notes[0]?.markdown ?? '',
                  t('notes.emptyExcerpt'),
                )}
              </p>
              <NavigationAction
                href={`/notes/${encodeURIComponent(query.data.notes[0]?.id ?? '')}`}
                variant="secondary"
              >
                {t('notes.edit')}
              </NavigationAction>
            </article>
          </div>
          {query.hasMore ? (
            <Button
              isLoading={query.isLoadingMore}
              onClick={() => void query.loadMore()}
              variant="secondary"
            >
              {t('common.loadMore')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

type AutosaveStatus = 'dirty' | 'error' | 'saved' | 'saving';

function NoteEditor({ note }: { note: NoteDetail }) {
  const { error, isPending, remove, save } = useNoteMutation();
  const [title, setTitle] = useState(note.title);
  const [markdown, setMarkdown] = useState(note.markdown);
  const [mode, setMode] = useState<'preview' | 'write'>('write');
  const [status, setStatus] = useState<AutosaveStatus>('saved');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const revision = useRef(0);
  const { t } = useI18n();

  function markDirty() {
    revision.current += 1;
    setStatus('dirty');
  }

  useEffect(() => {
    if (status !== 'dirty' || isPending || !title.trim()) return;

    const savedRevision = revision.current;
    const timeout = window.setTimeout(() => {
      setStatus('saving');
      void save(note.id, { markdown, title: title.trim() })
        .then(() =>
          setStatus(revision.current === savedRevision ? 'saved' : 'dirty'),
        )
        .catch(() => setStatus('error'));
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [isPending, markdown, note.id, save, status, title]);

  useEffect(() => {
    if (!isConfirmingDelete) return;

    window.requestAnimationFrame(() => cancelDeleteRef.current?.focus());
  }, [isConfirmingDelete]);

  async function deleteNote() {
    try {
      await remove(note.id);
      void route('/notes');
    } catch {
      // L’erreur normalisée est affichée dans la zone de confirmation.
    }
  }

  return (
    <div class="space-y-5">
      <TextField
        error={!title.trim() ? t('notes.editor.titleRequired') : undefined}
        label={t('notes.editor.title')}
        maxLength={200}
        onInput={(event) => {
          setTitle(event.currentTarget.value);
          markDirty();
        }}
        value={title}
      />
      <div class="space-y-3">
        <p class="ui-text-muted text-sm leading-6">{t('notes.editor.help')}</p>
        <div
          aria-label={t('notes.editor.mode')}
          class="ui-subtle-surface inline-flex rounded-lg p-1"
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const nextMode = mode === 'write' ? 'preview' : 'write';
            setMode(nextMode);
            window.requestAnimationFrame(() => {
              document
                .querySelector<HTMLButtonElement>(
                  `[data-note-mode="${nextMode}"]`,
                )
                ?.focus();
            });
          }}
          role="tablist"
        >
          <button
            aria-controls="note-write-panel"
            aria-selected={mode === 'write'}
            class={`min-h-11 rounded-lg px-4 text-sm font-semibold ${
              mode === 'write'
                ? 'bg-[var(--color-action)] text-[var(--color-on-action)]'
                : 'ui-text-muted'
            }`}
            data-note-mode="write"
            id="note-write-tab"
            onClick={() => setMode('write')}
            role="tab"
            type="button"
          >
            {t('notes.editor.write')}
          </button>
          <button
            aria-controls="note-preview-panel"
            aria-selected={mode === 'preview'}
            class={`min-h-11 rounded-lg px-4 text-sm font-semibold ${
              mode === 'preview'
                ? 'bg-[var(--color-action)] text-[var(--color-on-action)]'
                : 'ui-text-muted'
            }`}
            data-note-mode="preview"
            id="note-preview-tab"
            onClick={() => setMode('preview')}
            role="tab"
            type="button"
          >
            {t('notes.editor.preview')}
          </button>
        </div>
        {mode === 'write' ? (
          <div
            aria-labelledby="note-write-tab"
            id="note-write-panel"
            role="tabpanel"
          >
            <Textarea
              description={t('notes.editor.savedAutomatically')}
              label={t('notes.editor.content')}
              maxLength={100_000}
              onInput={(event) => {
                setMarkdown(event.currentTarget.value);
                markDirty();
              }}
              value={markdown}
            />
          </div>
        ) : (
          <div
            aria-labelledby="note-preview-tab"
            class="ui-control-surface min-h-32 rounded-lg p-4"
            id="note-preview-panel"
            role="tabpanel"
          >
            {markdown.trim() ? (
              <SafeMarkdown content={markdown} />
            ) : (
              <p class="ui-text-muted text-sm">{t('notes.editor.empty')}</p>
            )}
          </div>
        )}
      </div>
      <p
        aria-live="polite"
        class={
          status === 'error'
            ? 'ui-text-danger text-sm'
            : 'ui-text-muted text-sm'
        }
      >
        {!title.trim()
          ? t('notes.autosave.missingTitle')
          : t(`notes.autosave.${status}`)}
      </p>
      {note.lesson ? (
        <Card class="space-y-2">
          <Badge tone="neutral">{t('notes.linkedLesson')}</Badge>
          <p class="font-semibold">{note.lesson.title}</p>
          {note.program ? (
            <p class="ui-text-muted text-sm">{note.program.title}</p>
          ) : null}
          {note.program ? (
            <NavigationAction
              href={`/program/${encodeURIComponent(note.program.slug)}/lesson/${encodeURIComponent(note.lesson.slug)}`}
              variant="secondary"
            >
              {t('notes.editor.openLesson')}
            </NavigationAction>
          ) : null}
        </Card>
      ) : (
        <Badge tone="neutral">{t('notes.personal')}</Badge>
      )}
      <Card class="space-y-4">
        {isConfirmingDelete ? (
          <div
            aria-describedby="delete-note-description"
            aria-labelledby="delete-note-title"
            class="space-y-4"
            role="alertdialog"
          >
            <div>
              <h2 class="ui-text-danger font-semibold" id="delete-note-title">
                {t('notes.editor.deleteTitle')}
              </h2>
              <p
                class="ui-text-muted mt-2 text-sm leading-6"
                id="delete-note-description"
              >
                {t('notes.editor.deleteDescription')}
              </p>
            </div>
            {error ? (
              <ErrorState description={t('notes.editor.deleteError')} />
            ) : null}
            <div class="flex flex-col gap-3 sm:flex-row">
              <Button
                class="w-full sm:w-auto"
                disabled={isPending}
                elementRef={cancelDeleteRef}
                onClick={() => setIsConfirmingDelete(false)}
                variant="secondary"
              >
                {t('notes.editor.cancel')}
              </Button>
              <Button
                class="w-full sm:w-auto"
                isLoading={isPending}
                onClick={() => void deleteNote()}
                variant="danger"
              >
                {t('notes.editor.confirmDelete')}
              </Button>
            </div>
          </div>
        ) : (
          <div class="space-y-3">
            <div>
              <h2 class="font-semibold">{t('notes.editor.delete')}</h2>
              <p class="ui-text-muted mt-2 text-sm leading-6">
                {t('notes.editor.deleteDescription')}
              </p>
            </div>
            <Button
              disabled={isPending}
              onClick={() => setIsConfirmingDelete(true)}
              variant="danger"
            >
              {t('notes.editor.delete')}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

export function NotePage({ noteId }: { noteId: string }) {
  useBackNavigationTarget({
    href: '/notes',
    labelKey: 'navigation.back.notes',
  });
  const query = useNoteQuery(noteId);
  const { t } = useI18n();

  if (query.isPending) return <Spinner label={t('notes.editor.load')} />;
  if (query.error || !query.data?.note) {
    return <ErrorState description={t('notes.editor.loadError')} />;
  }

  return (
    <article
      aria-labelledby="note-title"
      class="page-layout page-layout--work space-y-6"
    >
      <header class="space-y-3">
        <NavigationAction href="/notes" variant="ghost">
          {t('notes.editor.back')}
        </NavigationAction>
        <h1 class="text-3xl font-bold tracking-tight" id="note-title">
          {t('notes.edit')}
        </h1>
      </header>
      <NoteEditor key={query.data.note.id} note={query.data.note} />
    </article>
  );
}
