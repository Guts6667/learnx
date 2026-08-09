import { useRef, useState } from 'preact/hooks';

import { Drawer } from '@/components/ui/Drawer';
import { NavigationAction } from '@/components/ui/NavigationAction';
import type { LessonActivity } from '@/lib/lesson-activity-sequence';
import { activityKey } from '@/lib/lesson-activity-sequence';
import { useI18n } from '@/i18n';

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

export function PedagogicalNavigation({
  activities,
  continueActivity,
  continueHref,
  continueLabel,
  currentKey,
  isContinueDisabled = false,
  isContinuePending = false,
  lessonTitle,
  moduleTitle,
  onContinue,
}: PedagogicalNavigationProps) {
  const { t } = useI18n();
  const resolvedContinueLabel = continueLabel ?? t('common.continue');
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
        aria-label={t('learning.navigation')}
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
              {t('learning.activityPosition', {
                current: currentIndex + 1,
                total: activities.length,
              })}
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
            {t('learning.summaryAction')}
          </button>
        </div>
        <div class="mt-3 grid min-w-0 grid-cols-2 items-end gap-3 border-t border-slate-800 pt-3">
          {previous ? (
            <NavigationAction
              class="w-full min-w-0 max-w-full text-center hyphens-auto [overflow-wrap:anywhere]"
              href={previous.href}
              size="sm"
              variant="secondary"
            >
              {t('common.previous')}
            </NavigationAction>
          ) : (
            <span
              aria-disabled="true"
              class="inline-flex min-h-11 min-w-0 max-w-full items-center justify-center rounded-xl bg-slate-900 px-3 text-center text-sm text-slate-500 hyphens-auto [overflow-wrap:anywhere]"
            >
              {t('common.previous')}
            </span>
          )}
          {onContinue ? (
            <button
              aria-busy={isContinuePending || undefined}
              class="inline-flex min-h-11 w-full min-w-0 max-w-full items-center justify-center rounded-xl bg-cyan-400 px-3 text-center text-sm font-semibold text-slate-950 hyphens-auto [overflow-wrap:anywhere] disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-500"
              disabled={isContinueDisabled || isContinuePending}
              onClick={onContinue}
              type="button"
            >
              {isContinuePending
                ? `${t('common.loading')}…`
                : resolvedContinueLabel}
            </button>
          ) : nextHref ? (
            <NavigationAction
              class="w-full min-w-0 max-w-full text-center hyphens-auto [overflow-wrap:anywhere]"
              href={nextHref}
              size="sm"
            >
              {resolvedContinueLabel}
            </NavigationAction>
          ) : (
            <span
              aria-disabled="true"
              class="inline-flex min-h-11 min-w-0 max-w-full items-center justify-center rounded-xl bg-slate-900 px-3 text-center text-sm text-slate-500 hyphens-auto [overflow-wrap:anywhere]"
            >
              {resolvedContinueLabel}
            </span>
          )}
        </div>
      </nav>
      <Drawer
        isOpen={isSummaryOpen}
        onDismiss={() => setIsSummaryOpen(false)}
        returnFocusElement={summaryTriggerRef.current}
        title={t('learning.summary')}
      >
        <p class="mb-4 text-sm text-slate-300">
          {t('learning.activityPosition', {
            current: currentIndex + 1,
            total: activities.length,
          })}
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
                    {isCurrent ? `${t('learning.currentActivity')} · ` : ''}
                    {t(
                      activity.status === 'COMPLETED'
                        ? 'learning.status.completed'
                        : activity.status === 'IN_PROGRESS'
                          ? 'learning.status.current'
                          : activity.status === 'PREVIEW'
                            ? 'common.draft'
                            : 'learning.status.todo',
                    )}
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
