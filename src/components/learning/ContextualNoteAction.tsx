import { route } from 'preact-router';
import { useEffect, useRef, useState } from 'preact/hooks';

import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { ErrorState } from '@/components/ui/ErrorState';
import { Textarea } from '@/components/ui/Textarea';
import { TextField } from '@/components/ui/TextField';
import { useNoteMutation, type NoteDetail } from '@/features/notes/queries';
import type { LessonActivity } from '@/lib/lesson-activity-sequence';
import { useI18n } from '@/i18n';

type AutosaveStatus = 'dirty' | 'error' | 'saved' | 'saving';

export function ContextualNoteAction({
  activity,
  lesson,
}: {
  activity: LessonActivity;
  lesson: { id: string; title: string };
}) {
  const mutation = useNoteMutation();
  const { t } = useI18n();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const revision = useRef(0);
  const [creationKey] = useState(() => crypto.randomUUID());
  const [isOpen, setIsOpen] = useState(false);
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [title, setTitle] = useState(
    t('notes.context.defaultTitle', { title: lesson.title }),
  );
  const [markdown, setMarkdown] = useState('');
  const [status, setStatus] = useState<AutosaveStatus>('saved');

  async function ensureNote() {
    try {
      const created = await mutation.create({
        creationKey,
        lessonId: lesson.id,
        sequenceItemId: activity.sequenceItemId ?? undefined,
        title,
      });
      setNote(created);
      setTitle(created.title);
      setMarkdown(created.markdown);
      setStatus('saved');
    } catch {
      // L’erreur normalisée est rendue dans le tiroir.
    }
  }

  function open() {
    setIsOpen(true);
    if (!note && !mutation.isPending) void ensureNote();
  }

  function markDirty() {
    revision.current += 1;
    setStatus('dirty');
  }

  useEffect(() => {
    if (!note || status !== 'dirty' || mutation.isPending || !title.trim()) {
      return;
    }

    const savedRevision = revision.current;
    const timeout = window.setTimeout(() => {
      setStatus('saving');
      void mutation
        .save(note.id, { markdown, title: title.trim() })
        .then((updated) => {
          setNote(updated);
          setStatus(revision.current === savedRevision ? 'saved' : 'dirty');
        })
        .catch(() => setStatus('error'));
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [markdown, mutation, note, status, title]);

  return (
    <div class="space-y-3">
      <Button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        class="w-full gap-2 sm:w-auto"
        elementRef={triggerRef}
        onClick={open}
        variant="secondary"
      >
        <span aria-hidden="true">✎</span>
        {t('notes.context.take')}
      </Button>
      <Drawer
        isOpen={isOpen}
        onDismiss={() => setIsOpen(false)}
        returnFocusElement={triggerRef.current}
        title={t('notes.context.take')}
      >
        <div class="space-y-5">
          <p class="text-sm leading-6 text-slate-300">
            {t(
              activity.sequenceItemId
                ? 'notes.context.linkedActivity'
                : 'notes.context.linked',
              { activity: activity.title, lesson: lesson.title },
            )}
          </p>
          {!note && mutation.isPending ? (
            <p aria-live="polite" class="text-sm text-slate-300">
              {t('notes.context.creating')}
            </p>
          ) : null}
          {!note && mutation.error ? (
            <div class="space-y-3">
              <ErrorState description={t('notes.createError')} />
              <Button onClick={() => void ensureNote()} variant="secondary">
                {t('common.retry')}
              </Button>
            </div>
          ) : null}
          {note ? (
            <>
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
              <p
                aria-live="polite"
                class={
                  status === 'error'
                    ? 'text-sm text-red-300'
                    : 'text-sm text-emerald-200'
                }
                role="status"
              >
                {status === 'saved'
                  ? t('notes.context.created')
                  : status === 'dirty'
                    ? t('notes.autosave.dirty')
                    : status === 'saving'
                      ? t('notes.autosave.saving')
                      : t('notes.autosave.error')}
              </p>
              <Button
                class="w-full sm:w-auto"
                onClick={() => void route(`/notes/${encodeURIComponent(note.id)}`)}
                variant="secondary"
              >
                {t('notes.context.view')}
              </Button>
            </>
          ) : null}
        </div>
      </Drawer>
    </div>
  );
}
