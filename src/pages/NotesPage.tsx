import type { TargetedKeyboardEvent } from 'preact';
import { route } from 'preact-router';
import { useEffect, useRef, useState } from 'preact/hooks';

import { useBackNavigationTarget } from '@/components/layout/BackNavigationContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { PageHeader } from '@/components/ui/PageHeader';
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

function NoteLine({
  isSelected,
  note,
  onSelect,
}: {
  isSelected: boolean;
  note: NoteDetail;
  onSelect: (note: NoteDetail) => void;
}) {
  const { locale, t } = useI18n();
  return (
    <li class="border-b border-[var(--color-border)] last:border-b-0">
      <button
        aria-pressed={isSelected}
        class={`group grid min-h-20 w-full gap-2 px-3 py-5 text-left outline-none transition-colors hover:bg-[var(--color-surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-inset sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8 ${isSelected ? 'bg-[var(--color-surface-subtle)]' : ''}`}
        data-note-select={note.id}
        onClick={() => onSelect(note)}
        type="button"
      >
        <div class="min-w-0 space-y-1">
          <h2 class="font-semibold text-[var(--color-heading)] group-hover:text-[var(--color-action)]">
            {note.title}
          </h2>
          <p class="truncate text-sm leading-6 text-[var(--color-text)]">
            {getExcerpt(note.markdown, t('notes.emptyExcerpt'))}
          </p>
          <p class="text-sm text-[var(--color-text-muted)]">
            {note.lesson
              ? `${note.program?.title ? `${note.program.title} · ` : ''}${note.lesson.title}`
              : t('notes.personal')}
          </p>
        </div>
        <p class="text-xs text-[var(--color-text-muted)] sm:text-right">
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const query = useNotesQuery(debouncedSearch);
  const [selectedNoteId, setSelectedNoteId] = useState<string>();
  const { t } = useI18n();

  const selectedNote =
    query.data?.notes.find((note) => note.id === selectedNoteId) ??
    query.data?.notes[0];

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 300);

    return () => window.clearTimeout(timeout);
  }, [search]);

  function selectNote(note: NoteDetail) {
    if (window.matchMedia('(min-width: 64rem)').matches) {
      setSelectedNoteId(note.id);
      return;
    }

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
    const nextId = nextButton?.dataset.noteSelect;
    if (nextId) setSelectedNoteId(nextId);
  }

  return (
    <section
      aria-labelledby="notes-title"
      class="page-layout page-layout--work page-shell"
    >
      <PageHeader
        description={t('notes.description')}
        eyebrow={t('notes.eyebrow')}
        id="notes-title"
        title={t('notes.title')}
      />

      <div class="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <TextField
          label={t('notes.search')}
          onInput={(event) => setSearch(event.currentTarget.value)}
          placeholder={t('notes.searchPlaceholder')}
          type="search"
          value={search}
        />
        <Button
          class="w-full md:w-auto"
          onClick={() => void route('/notes/new')}
          size="lg"
        >
          {t('notes.new')}
        </Button>
      </div>

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
          <div class="totem-notes-master-detail">
            <ul
              aria-label={t('notes.title')}
              class="border-y border-[var(--color-border)]"
              onKeyDown={navigateNoteList}
            >
              {query.data.notes.map((note) => (
                <NoteLine
                  isSelected={note.id === selectedNote?.id}
                  key={note.id}
                  note={note}
                  onSelect={selectNote}
                />
              ))}
            </ul>
            {selectedNote ? (
              <article
                aria-live="polite"
                class="totem-notes-detail"
                key={selectedNote.id}
              >
                <p class="page-eyebrow">
                  {selectedNote.lesson
                    ? `${selectedNote.program?.title ? `${selectedNote.program.title} · ` : ''}${selectedNote.lesson.title}`
                    : t('notes.personal')}
                </p>
                <h2 class="text-2xl font-medium">{selectedNote.title}</h2>
                <SafeMarkdown content={selectedNote.markdown} />
                <NavigationAction
                  href={`/notes/${encodeURIComponent(selectedNote.id)}`}
                  variant="secondary"
                >
                  {t('notes.edit')}
                </NavigationAction>
              </article>
            ) : null}
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
    <div class="totem-note-editor-layout">
      <div class="min-w-0 space-y-5">
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
            ? t('notes.save.missingTitle')
            : t(`notes.save.${status}`)}
        </p>
        <div class="ui-sticky-mobile-action">
          <Button
            class="w-full sm:w-auto"
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
        <aside class="totem-note-editor-context space-y-4">
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
                  <h2
                    class="ui-text-danger font-semibold"
                    id="delete-note-title"
                  >
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
                <div class="flex flex-col gap-3">
                  <Button
                    class="w-full"
                    disabled={isPending}
                    elementRef={cancelDeleteRef}
                    onClick={() => setIsConfirmingDelete(false)}
                    variant="secondary"
                  >
                    {t('notes.editor.cancel')}
                  </Button>
                  <Button
                    class="w-full"
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

export function NewNotePage() {
  useBackNavigationTarget({
    href: '/notes',
    labelKey: 'navigation.back.notes',
  });
  const { t } = useI18n();

  return (
    <article
      aria-labelledby="new-note-title"
      class="page-layout page-layout--work space-y-6"
    >
      <header class="space-y-3">
        <NavigationAction href="/notes" variant="ghost">
          {t('notes.editor.back')}
        </NavigationAction>
        <h1 class="text-3xl font-medium tracking-tight" id="new-note-title">
          {t('notes.new')}
        </h1>
      </header>
      <NoteEditor />
    </article>
  );
}
