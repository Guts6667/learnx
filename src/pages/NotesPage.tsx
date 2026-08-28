import type { KeyboardEvent as TargetedKeyboardEvent } from 'react';
import { navigate as route } from '@/app/navigation';
import { useEffect, useRef, useState } from 'react';

import { useBackNavigationTarget } from '@/components/layout/BackNavigationContext';
import { QueryState } from '@/components/learnx/QueryState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { PageHeader } from '@/components/ui/PageHeader';
import { SafeMarkdown } from '@/components/ui/SafeMarkdown';
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

function NoteLine({
  note,
  onOpen,
}: {
  note: NoteDetail;
  onOpen: (note: NoteDetail) => void;
}) {
  const { locale, t } = useI18n();
  return (
    <li className="border-b border-[var(--color-border)] last:border-b-0">
      <button
        className="group grid min-h-20 w-full gap-2 px-3 py-5 text-left outline-none transition-colors hover:bg-[var(--color-surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-inset sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8"
        data-note-select={note.id}
        onClick={() => onOpen(note)}
        type="button"
      >
        <div className="min-w-0 space-y-1">
          <h2 className="font-semibold text-[var(--color-heading)] group-hover:text-[var(--color-action)]">
            {note.title}
          </h2>
          <p className="truncate text-sm leading-6 text-[var(--color-text)]">
            {getExcerpt(note.markdown, t('notes.emptyExcerpt'))}
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">
            {note.lesson
              ? `${note.program?.title ? `${note.program.title} · ` : ''}${note.lesson.title}`
              : t('notes.personal')}
          </p>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] sm:text-right">
          {t('notes.updatedAt', {
            date: formatUpdatedAt(note.updatedAt, locale),
          })}
        </p>
      </button>
    </li>
  );
}

export function NotesPage() {
  const [search, setSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(min-width: 64rem)').matches,
  );
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const query = useNotesQuery(debouncedSearch);
  const { t } = useI18n();

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 300);

    return () => window.clearTimeout(timeout);
  }, [search]);

  function openNote(note: NoteDetail) {
    void route(`/notes/${encodeURIComponent(note.id)}`);
  }

  function navigateNoteList(event: TargetedKeyboardEvent<HTMLUListElement>) {
    if (!['ArrowDown', 'ArrowUp', 'End', 'Home'].includes(event.key)) return;

    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[data-note-select]',
      ),
    );
    const currentIndex = buttons.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    if (currentIndex < 0) return;

    event.preventDefault();
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : event.key === 'ArrowDown'
            ? Math.min(buttons.length - 1, currentIndex + 1)
            : Math.max(0, currentIndex - 1);
    const nextButton = buttons[nextIndex];
    nextButton?.focus();
  }

  return (
    <section
      aria-labelledby="notes-title"
      className="page-layout page-layout--work page-shell"
    >
      <div className="notes-page-head">
        <PageHeader
          description={t('notes.description')}
          eyebrow={t('notes.eyebrow')}
          id="notes-title"
          title={t('notes.title')}
        />
        <div className="notes-page-head__actions">
          <Button
            aria-expanded={isSearchOpen}
            aria-label={t('notes.search')}
            className="notes-search-toggle"
            onClick={() => setIsSearchOpen((value) => !value)}
            variant="secondary"
          >
            <span aria-hidden="true">⌕</span>
          </Button>
          <Button
            aria-label={t('notes.new')}
            className="notes-new-action"
            onClick={() => void route('/notes/new')}
          >
            <span aria-hidden="true">＋</span>
            <span className="notes-new-action__label">{t('notes.new')}</span>
          </Button>
        </div>
      </div>

      <QueryState
        error={query.error}
        errorDescription={t('notes.loadError')}
        isPending={query.isPending}
        loadingLabel={t('notes.loading')}
        onRetry={query.refetch}
        retryLabel={t('common.retry')}
      />
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
        <div className="space-y-4">
          <div className="totem-notes-list">
            <div className="totem-notes-master">
              {isSearchOpen ? (
                <div className="notes-search-field notes-search-field--open">
                  <TextField
                    label={t('notes.search')}
                    onInput={(event) => setSearch(event.currentTarget.value)}
                    placeholder={t('notes.searchPlaceholder')}
                    type="search"
                    value={search}
                  />
                </div>
              ) : null}
              <header className="totem-notes-master__header">
                <h2>{t('notes.recent')}</h2>
                <span>
                  {t('notes.count', { count: query.data.notes.length })}
                </span>
              </header>
              <ul
                aria-label={t('notes.title')}
                className="border-y border-[var(--color-border)]"
                onKeyDown={navigateNoteList}
              >
                {query.data.notes.map((note) => (
                  <NoteLine key={note.id} note={note} onOpen={openNote} />
                ))}
              </ul>
            </div>
          </div>
          {query.hasMore && !query.loadMoreError ? (
            <Button
              isLoading={query.isLoadingMore}
              onClick={() => void query.loadMore()}
              variant="secondary"
            >
              {t('common.loadMore')}
            </Button>
          ) : null}
          {query.loadMoreError ? (
            <ErrorState
              action={
                <Button
                  onClick={() => void query.loadMore()}
                  variant="secondary"
                >
                  {t('common.retry')}
                </Button>
              }
              description={t('notes.loadMoreError')}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

type SaveStatus = 'dirty' | 'error' | 'saved' | 'saving';

function NoteEditor({ note }: { note?: NoteDetail }) {
  const { create, error, isPending, remove, save } = useNoteMutation();
  const [title, setTitle] = useState(note?.title ?? '');
  const [markdown, setMarkdown] = useState(note?.markdown ?? '');
  const [mode, setMode] = useState<'preview' | 'write'>('write');
  const [status, setStatus] = useState<SaveStatus>(note ? 'saved' : 'dirty');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const revision = useRef(0);
  const { t } = useI18n();

  function markDirty() {
    revision.current += 1;
    setStatus('dirty');
  }

  async function saveNote() {
    if (status !== 'dirty' || isPending || !title.trim()) return;
    const savedRevision = revision.current;
    setStatus('saving');
    try {
      if (!note) {
        const created = await create({ markdown, title: title.trim() });
        setStatus('saved');
        void route(`/notes/${encodeURIComponent(created.id)}`, true);
        return;
      }

      await save(note.id, { markdown, title: title.trim() });
      setStatus(revision.current === savedRevision ? 'saved' : 'dirty');
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => {
    if (!isConfirmingDelete) return;

    window.requestAnimationFrame(() => cancelDeleteRef.current?.focus());
  }, [isConfirmingDelete]);

  async function deleteNote() {
    if (!note) return;
    try {
      await remove(note.id);
      void route('/notes');
    } catch {
      // L’erreur normalisée est affichée dans la zone de confirmation.
    }
  }

  return (
    <div className="totem-note-editor-layout">
      <div className="min-w-0 space-y-5">
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
        <div className="space-y-3">
          <p className="ui-text-muted text-sm leading-6">
            {t('notes.editor.help')}
          </p>
          <div
            aria-label={t('notes.editor.mode')}
            className="ui-subtle-surface inline-flex rounded-lg p-1"
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
                return;
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
              className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${
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
              className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${
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
                description={t('notes.editor.explicitSave')}
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
              className="ui-control-surface min-h-32 rounded-lg p-4"
              id="note-preview-panel"
              role="tabpanel"
            >
              {markdown.trim() ? (
                <SafeMarkdown content={markdown} />
              ) : (
                <p className="ui-text-muted text-sm">
                  {t('notes.editor.empty')}
                </p>
              )}
            </div>
          )}
        </div>
        <p
          aria-live="polite"
          className={
            status === 'error'
              ? 'ui-text-danger text-sm'
              : 'ui-text-muted text-sm'
          }
        >
          {!title.trim()
            ? t('notes.save.missingTitle')
            : t(`notes.save.${status}`)}
        </p>
        <div className="ui-sticky-mobile-action">
          <Button
            className="w-full sm:w-auto"
            disabled={status !== 'dirty' || !title.trim()}
            isLoading={status === 'saving'}
            onClick={() => void saveNote()}
            size="lg"
          >
            {t(note ? 'notes.editor.save' : 'notes.editor.create')}
          </Button>
        </div>
      </div>
      {note ? (
        <aside className="totem-note-editor-context space-y-4">
          {note.lesson ? (
            <Card className="space-y-2">
              <Badge tone="neutral">{t('notes.linkedLesson')}</Badge>
              <p className="font-semibold">{note.lesson.title}</p>
              {note.program ? (
                <p className="ui-text-muted text-sm">{note.program.title}</p>
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
          <Card className="space-y-4">
            {isConfirmingDelete ? (
              <div
                aria-describedby="delete-note-description"
                aria-labelledby="delete-note-title"
                className="space-y-4"
                role="alertdialog"
              >
                <div>
                  <h2
                    className="ui-text-danger font-semibold"
                    id="delete-note-title"
                  >
                    {t('notes.editor.deleteTitle')}
                  </h2>
                  <p
                    className="ui-text-muted mt-2 text-sm leading-6"
                    id="delete-note-description"
                  >
                    {t('notes.editor.deleteDescription')}
                  </p>
                </div>
                {error ? (
                  <ErrorState description={t('notes.editor.deleteError')} />
                ) : null}
                <div className="flex flex-col gap-3">
                  <Button
                    className="w-full"
                    disabled={isPending}
                    elementRef={cancelDeleteRef}
                    onClick={() => setIsConfirmingDelete(false)}
                    variant="secondary"
                  >
                    {t('notes.editor.cancel')}
                  </Button>
                  <Button
                    className="w-full"
                    isLoading={isPending}
                    onClick={() => void deleteNote()}
                    variant="danger"
                  >
                    {t('notes.editor.confirmDelete')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <h2 className="font-semibold">{t('notes.editor.delete')}</h2>
                  <p className="ui-text-muted mt-2 text-sm leading-6">
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
        </aside>
      ) : null}
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

  if (query.isPending || query.error) {
    return (
      <QueryState
        error={query.error}
        errorDescription={t('notes.editor.loadError')}
        isPending={query.isPending}
        loadingLabel={t('notes.editor.load')}
        onRetry={query.refetch}
        retryLabel={t('common.retry')}
      />
    );
  }
  if (!query.data?.note) {
    return <ErrorState description={t('notes.editor.loadError')} />;
  }

  return (
    <article
      aria-labelledby="note-title"
      className="page-layout page-layout--work space-y-6"
    >
      <header className="space-y-3">
        <NavigationAction href="/notes" variant="ghost">
          {t('notes.editor.back')}
        </NavigationAction>
        <h1 className="text-3xl font-bold tracking-tight" id="note-title">
          {t('notes.edit')}
        </h1>
      </header>
      <NoteEditor key={query.data.note.id} note={query.data.note} />
    </article>
  );
}

export function NewNotePage() {
  useBackNavigationTarget({
    href: '/notes',
    labelKey: 'navigation.back.notes',
  });
  const { t } = useI18n();

  return (
    <article
      aria-labelledby="new-note-title"
      className="page-layout page-layout--work space-y-6"
    >
      <header className="space-y-3">
        <NavigationAction href="/notes" variant="ghost">
          {t('notes.editor.back')}
        </NavigationAction>
        <h1 className="text-3xl font-medium tracking-tight" id="new-note-title">
          {t('notes.new')}
        </h1>
      </header>
      <NoteEditor />
    </article>
  );
}
