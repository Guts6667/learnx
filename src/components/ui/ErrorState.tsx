import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';

import { classNames } from '@/components/ui/classNames';

interface ErrorStateProps {
  action?: ComponentChildren;
  class?: string;
  description: string;
  title?: string;
}

export function ErrorState({
  action,
  class: className,
  description,
  title = 'Une erreur est survenue',
}: ErrorStateProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      class={classNames(
        'rounded-2xl border border-red-900 bg-red-950/40 p-5',
        className,
      )}
      role="alert"
    >
      <h2 class="text-lg font-semibold text-red-100" id={titleId}>
        {title}
      </h2>
      <p class="mt-2 text-sm leading-6 text-red-200">{description}</p>
      {action ? <div class="mt-5">{action}</div> : null}
    </section>
  );
}
