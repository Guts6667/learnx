import type { LessonActivity } from '@/lib/lesson-activity-sequence';
import { activityKey } from '@/lib/lesson-activity-sequence';

interface PedagogicalNavigationProps {
  activities: LessonActivity[];
  currentKey: string;
  lessonHref: string;
  lessonTitle: string;
  moduleTitle: string;
}

export function PedagogicalNavigation({
  activities,
  currentKey,
  lessonHref,
  lessonTitle,
  moduleTitle,
}: PedagogicalNavigationProps) {
  const currentIndex = Math.max(
    0,
    activities.findIndex(
      (activity) => activityKey(activity.kind, activity.id) === currentKey,
    ),
  );
  const previous = activities[currentIndex - 1] ?? null;
  const next = activities[currentIndex + 1] ?? null;

  return (
    <nav
      aria-label="Sommaire de la leçon"
      class="sticky z-30 rounded-2xl border border-cyan-900/80 bg-slate-950/95 p-3 shadow-xl shadow-slate-950/40 backdrop-blur lg:top-4 lg:bottom-auto"
      style={{
        bottom:
          'calc(var(--app-navigation-height) + env(safe-area-inset-bottom))',
      }}
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="min-w-0">
          <p class="truncate text-xs font-semibold text-cyan-300">
            {moduleTitle}
          </p>
          <p class="truncate text-sm font-medium text-slate-100">
            {lessonTitle}
          </p>
          <p class="mt-1 text-xs text-slate-400">
            Activité {currentIndex + 1} sur {activities.length}
          </p>
        </div>
        <a
          class="inline-flex min-h-11 items-center rounded-xl bg-slate-800 px-3 text-sm font-semibold text-slate-100"
          href={`${lessonHref}?activity=${encodeURIComponent(currentKey)}`}
        >
          Retour à la leçon
        </a>
      </div>
      <div class="mt-3 grid grid-cols-3 gap-2">
        {previous ? (
          <a
            class="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-800 px-2 text-center text-sm font-semibold"
            href={previous.href}
          >
            Précédent
          </a>
        ) : (
          <span class="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-2 text-sm text-slate-500">
            Précédent
          </span>
        )}
        <details class="group contents">
          <summary class="inline-flex min-h-11 cursor-pointer list-none items-center justify-center rounded-xl border border-cyan-700 bg-cyan-950 px-2 text-center text-sm font-semibold text-cyan-100">
            Sommaire de la leçon
          </summary>
          <div class="col-span-3 mt-1 rounded-xl border border-slate-700 bg-slate-950 p-3">
            <ol class="grid gap-1">
              {activities.map((activity, index) => {
                const key = activityKey(activity.kind, activity.id);
                return (
                  <li key={key}>
                    <a
                      aria-current={key === currentKey ? 'step' : undefined}
                      aria-label={activity.title}
                      class={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                        key === currentKey
                          ? 'bg-cyan-950 text-cyan-100'
                          : 'text-slate-300 hover:bg-slate-900'
                      }`}
                      href={activity.href}
                    >
                      <span class="text-xs text-slate-500">{index + 1}</span>
                      <span>{activity.title}</span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </div>
        </details>
        {next ? (
          <a
            class="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-400 px-2 text-center text-sm font-semibold text-slate-950"
            href={next.href}
          >
            Suivant
          </a>
        ) : (
          <span class="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-2 text-sm text-slate-500">
            Continuer
          </span>
        )}
      </div>
    </nav>
  );
}
