import { useRef, useState } from 'preact/hooks';

import { Button } from '@/components/ui/Button';
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
        class="ui-learning-navigation min-w-0 py-4"
      >
        <div class="flex min-w-0 items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="page-eyebrow break-words text-xs">
              {moduleTitle}
            </p>
            <p class="ui-text break-words text-sm font-medium">
              {lessonTitle}
            </p>
            <p class="ui-text-muted mt-1 text-xs">
              {t('learning.activityPosition', {
                current: currentIndex + 1,
                total: activities.length,
              })}
            </p>
          </div>
          <Button
            aria-expanded={isSummaryOpen}
            aria-haspopup="dialog"
            class="shrink-0"
            onClick={() => setIsSummaryOpen(true)}
            elementRef={summaryTriggerRef}
            size="sm"
            variant="secondary"
          >
            {t('learning.summaryAction')}
          </Button>
        </div>
        <div class="pedagogical-navigation__actions ui-divider mt-4 grid min-w-0 items-end gap-3 border-t pt-4">
          {previous ? (
            <NavigationAction
              class="w-full min-w-0 max-w-full text-center"
              href={previous.href}
              size="sm"
              variant="secondary"
            >
              {t('common.previous')}
            </NavigationAction>
          ) : (
            <span
              aria-disabled="true"
              class="ui-action ui-action--secondary ui-action--sm min-w-0 max-w-full text-center opacity-60"
            >
              {t('common.previous')}
            </span>
          )}
          {onContinue ? (
            <Button
              aria-busy={isContinuePending || undefined}
              class="w-full min-w-0 max-w-full text-center"
              disabled={isContinueDisabled || isContinuePending}
              isLoading={isContinuePending}
              onClick={onContinue}
              size="sm"
            >
              {resolvedContinueLabel}
            </Button>
          ) : nextHref ? (
            <NavigationAction
              class="w-full min-w-0 max-w-full text-center"
              href={nextHref}
              size="sm"
            >
              {resolvedContinueLabel}
            </NavigationAction>
          ) : (
            <span
              aria-disabled="true"
              class="ui-action ui-action--secondary ui-action--sm min-w-0 max-w-full text-center opacity-60"
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
        <p class="ui-text-muted mb-4 text-sm">
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
                  class="ui-learning-navigation__activity grid min-h-11 min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-x-2 rounded-lg px-3 py-3 text-sm"
                  href={activity.href}
                  onClick={() => setIsSummaryOpen(false)}
                >
                  <span
                    aria-hidden="true"
                    class="ui-text row-span-2 text-center text-xs"
                  >
                    {index + 1}
                  </span>
                  <span class="ui-text min-w-0 text-xs font-semibold">
                    {activity.label}
                  </span>
                  <span class="min-w-0 break-words font-medium">
                    {activity.title}
                  </span>
                  <span class="ui-text col-start-2 mt-1 min-w-0 text-xs">
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
