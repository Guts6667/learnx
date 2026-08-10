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
        'ui-feedback ui-feedback--empty p-6',
        className,
      )}
    >
      <h2 class="ui-feedback__title" id={titleId}>
        {title}
      </h2>
      <p class="ui-feedback__description">{description}</p>
      {action ? <div class="mt-5">{action}</div> : null}
    </section>
  );
}
