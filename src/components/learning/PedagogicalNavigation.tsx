import { useRef, useState } from 'preact/hooks';

import { Drawer } from '@/components/ui/Drawer';
import { NavigationAction } from '@/components/ui/NavigationAction';
import type { LessonActivity } from '@/lib/lesson-activity-sequence';
import { activityKey } from '@/lib/lesson-activity-sequence';

interface PedagogicalNavigationProps {
  activities: LessonActivity[];
  continueActivity?: LessonActivity | null;
  continueHref?: string;
  continueLabel?: string;
  currentKey: string;
  isContinueDisabled?: boolean;
  isContinuePending?: boolean;
  lessonTitle: string;
  moduleTitle: string;
  onContinue?: () => void;
}

const statusLabels: Record<LessonActivity['status'], string> = {
  AVAILABLE: 'À faire',
  COMPLETED: 'Terminée',
  IN_PROGRESS: 'En cours',
  PREVIEW: 'Brouillon',
};

export function PedagogicalNavigation({
  activities,
  continueActivity,
  continueHref,
  continueLabel = 'Continuer',
  currentKey,
  isContinueDisabled = false,
  isContinuePending = false,
  lessonTitle,
  moduleTitle,
  onContinue,
}: PedagogicalNavigationProps) {
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const summaryTriggerRef = useRef<HTMLButtonElement>(null);
  const currentIndex = Math.max(
    0,
    activities.findIndex(
      (activity) => activityKey(activity.kind, activity.id) === currentKey,
    ),
  );
  const previous = activities[currentIndex - 1] ?? null;
  const next =
    continueActivity === undefined
      ? (activities[currentIndex + 1] ?? null)
      : continueActivity;
  const nextHref = continueHref ?? next?.href ?? null;

  return (
    <>
      <nav
        aria-label="Navigation pédagogique"
        class="min-w-0 rounded-2xl border border-cyan-900/80 bg-slate-950 p-3"
      >
        <div class="flex min-w-0 items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="break-words text-xs font-semibold text-cyan-300">
              {moduleTitle}
            </p>
            <p class="break-words text-sm font-medium text-slate-100">
              {lessonTitle}
            </p>
            <p class="mt-1 text-xs text-slate-400">
              Activité {currentIndex + 1} sur {activities.length}
            </p>
          </div>
          <button
            aria-expanded={isSummaryOpen}
            aria-haspopup="dialog"
            class="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-cyan-700 bg-cyan-950 px-3 text-sm font-semibold text-cyan-100"
            onClick={() => setIsSummaryOpen(true)}
            ref={summaryTriggerRef}
            type="button"
          >
            Sommaire
          </button>
        </div>
        <div class="mt-3 flex min-w-0 items-end justify-between gap-3 border-t border-slate-800 pt-3">
          {previous ? (
            <NavigationAction
              class="min-w-0"
              href={previous.href}
              size="sm"
              variant="secondary"
            >
              Précédent
            </NavigationAction>
          ) : (
            <span
              aria-disabled="true"
              class="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-3 text-sm text-slate-500"
            >
              Précédent
            </span>
          )}
          {onContinue ? (
            <button
              aria-busy={isContinuePending || undefined}
              class="inline-flex min-h-11 min-w-0 items-center rounded-xl bg-cyan-400 px-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-500"
              disabled={isContinueDisabled || isContinuePending}
              onClick={onContinue}
              type="button"
            >
              {isContinuePending ? 'Chargement…' : continueLabel}
            </button>
          ) : nextHref ? (
            <NavigationAction class="min-w-0" href={nextHref} size="sm">
              {continueLabel}
            </NavigationAction>
          ) : (
            <span
              aria-disabled="true"
              class="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-3 text-sm text-slate-500"
            >
              {continueLabel}
            </span>
          )}
        </div>
      </nav>
      <Drawer
        isOpen={isSummaryOpen}
        onDismiss={() => setIsSummaryOpen(false)}
        returnFocusElement={summaryTriggerRef.current}
        title="Sommaire de la leçon"
      >
        <p class="mb-4 text-sm text-slate-300">
          Activité {currentIndex + 1} sur {activities.length}
        </p>
        <ol class="grid min-w-0 grid-cols-1 gap-2 overflow-x-hidden">
          {activities.map((activity, index) => {
            const key = activityKey(activity.kind, activity.id);
            const isCurrent = key === currentKey;
            return (
              <li class="min-w-0" key={key}>
                <a
                  aria-current={isCurrent ? 'step' : undefined}
                  class={`grid min-h-11 min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-x-2 rounded-xl border px-3 py-3 text-sm ${
                    isCurrent
                      ? 'border-cyan-400 bg-cyan-950 text-cyan-100 outline outline-1 outline-cyan-400'
                      : 'border-slate-800 text-slate-200 hover:bg-slate-900'
                  }`}
                  href={activity.href}
                  onClick={() => setIsSummaryOpen(false)}
                >
                  <span
                    aria-hidden="true"
                    class="row-span-2 text-center text-xs text-slate-400"
                  >
                    {index + 1}
                  </span>
                  <span class="min-w-0 text-xs font-semibold text-slate-400">
                    {activity.label}
                  </span>
                  <span class="min-w-0 break-words font-medium">
                    {activity.title}
                  </span>
                  <span class="col-start-2 mt-1 min-w-0 text-xs text-slate-400">
                    {isCurrent ? 'Activité actuelle · ' : ''}
                    {statusLabels[activity.status]}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </Drawer>
    </>
  );
}
