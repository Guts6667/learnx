import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';

import { classNames } from '@/components/ui/classNames';

interface EmptyStateProps {
  action?: ComponentChildren;
  class?: string;
  description: string;
  title: string;
}

export function EmptyState({
  action,
  class: className,
  description,
  title,
}: EmptyStateProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      class={classNames(
        'rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-6 text-center',
        className,
      )}
    >
      <h2 class="text-lg font-semibold text-slate-100" id={titleId}>
        {title}
      </h2>
      <p class="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      {action ? <div class="mt-5">{action}</div> : null}
    </section>
  );
}
