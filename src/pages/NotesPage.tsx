import { route } from 'preact-router';
import { useEffect, useRef, useState } from 'preact/hooks';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
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

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getExcerpt(markdown: string): string {
  const normalized = markdown.replace(/\s+/g, ' ').trim();

  if (!normalized) return 'Note vide';

  return normalized.length > 140 ? `${normalized.slice(0, 137)}…` : normalized;
}

function NoteCard({ note }: { note: NoteDetail }) {
  return (
    <li>
      <Card class="space-y-3">
        <div class="flex items-start justify-between gap-3">
          <h2 class="font-semibold">{note.title}</h2>
          {note.lesson ? <Badge tone="neutral">Liée à une leçon</Badge> : null}
        </div>
        <p class="text-sm leading-6 text-slate-300">
          {getExcerpt(note.markdown)}
        </p>
        {note.lesson ? (
          <p class="text-sm text-slate-400">
            {note.program?.title ? `${note.program.title} · ` : ''}
            {note.lesson.title}
          </p>
        ) : (
          <p class="text-sm text-slate-400">Note personnelle</p>
        )}
        <p class="text-xs text-slate-400">
          Modifiée le {formatUpdatedAt(note.updatedAt)}
        </p>
        <a
          class="inline-flex min-h-11 items-center text-cyan-300 underline"
          href={`/notes/${encodeURIComponent(note.id)}`}
        >
          Modifier la note
        </a>
      </Card>
    </li>
  );
}

export function NotesPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const query = useNotesQuery(debouncedSearch);
  const mutation = useNoteMutation();

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
    <section aria-labelledby="notes-title" class="page-shell">
      <PageHeader
        description="Conservez vos idées libres ou rattachez-les à une leçon."
        eyebrow="Espace personnel"
        id="notes-title"
        title="Notes"
      />

      <div class="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <TextField
          label="Rechercher dans les notes"
          onInput={(event) => setSearch(event.currentTarget.value)}
          placeholder="Titre ou contenu"
          type="search"
          value={search}
        />
        <Button
          class="w-full md:w-auto"
          isLoading={mutation.isPending}
          onClick={() => void createNote()}
          size="lg"
        >
          Nouvelle note
        </Button>
      </div>

      {mutation.error ? (
        <ErrorState description="La note n’a pas pu être créée." />
      ) : null}
      {query.isPending ? <Skeleton label="Chargement des notes" /> : null}
      {query.error ? (
        <ErrorState description="Les notes n’ont pas pu être chargées." />
      ) : null}
      {!query.isPending && !query.error && query.data?.notes.length === 0 ? (
        <EmptyState
          description={
            debouncedSearch
              ? 'Essayez une autre recherche.'
              : 'Créez votre première note personnelle ou depuis une leçon.'
          }
          title={debouncedSearch ? 'Aucun résultat' : 'Aucune note'}
        />
      ) : null}
      {query.data?.notes.length ? (
        <ul class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {query.data.notes.map((note) => (
            <NoteCard key={note.id} note={note} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

type AutosaveStatus = 'dirty' | 'error' | 'saved' | 'saving';

function getAutosaveLabel(status: AutosaveStatus, hasTitle: boolean): string {
  if (!hasTitle) return 'Ajoutez un titre pour enregistrer.';
  if (status === 'dirty') return 'Modifications en attente…';
  if (status === 'error') return 'Échec de l’enregistrement.';
  if (status === 'saving') return 'Enregistrement…';
  return 'Toutes les modifications sont enregistrées.';
}

function NoteEditor({ note }: { note: NoteDetail }) {
  const { isPending, save } = useNoteMutation();
  const [title, setTitle] = useState(note.title);
  const [markdown, setMarkdown] = useState(note.markdown);
  const [status, setStatus] = useState<AutosaveStatus>('saved');
  const revision = useRef(0);

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

  return (
    <div class="space-y-5">
      <TextField
        error={!title.trim() ? 'Le titre est obligatoire.' : undefined}
        label="Titre"
        maxLength={200}
        onInput={(event) => {
          setTitle(event.currentTarget.value);
          markDirty();
        }}
        value={title}
      />
      <Textarea
        description="Vous pouvez utiliser la syntaxe Markdown. Le texte est sauvegardé automatiquement."
        label="Contenu de la note"
        maxLength={100_000}
        onInput={(event) => {
          setMarkdown(event.currentTarget.value);
          markDirty();
        }}
        value={markdown}
      />
      <p
        aria-live="polite"
        class={
          status === 'error' ? 'text-sm text-red-300' : 'text-sm text-slate-400'
        }
      >
        {getAutosaveLabel(status, Boolean(title.trim()))}
      </p>
      {note.lesson ? (
        <Card class="space-y-2">
          <Badge tone="neutral">Liée à une leçon</Badge>
          <p class="font-semibold">{note.lesson.title}</p>
          {note.program ? (
            <p class="text-sm text-slate-400">{note.program.title}</p>
          ) : null}
          {note.program ? (
            <a
              class="inline-flex min-h-11 items-center text-cyan-300 underline"
              href={`/program/${encodeURIComponent(note.program.slug)}/lesson/${encodeURIComponent(note.lesson.slug)}`}
            >
              Retour à la leçon
            </a>
          ) : null}
        </Card>
      ) : (
        <Badge tone="neutral">Note personnelle</Badge>
      )}
    </div>
  );
}

export function NotePage({ noteId }: { noteId: string }) {
  const query = useNoteQuery(noteId);

  if (query.isPending) return <Spinner label="Chargement de la note" />;
  if (query.error || !query.data?.note) {
    return <ErrorState description="La note n’a pas pu être chargée." />;
  }

  return (
    <article aria-labelledby="note-title" class="space-y-6">
      <header class="space-y-3">
        <a
          class="inline-flex min-h-11 items-center text-cyan-300 underline"
          href="/notes"
        >
          Retour aux notes
        </a>
        <h1 class="text-3xl font-bold tracking-tight" id="note-title">
          Modifier la note
        </h1>
      </header>
      <NoteEditor key={query.data.note.id} note={query.data.note} />
    </article>
  );
}
