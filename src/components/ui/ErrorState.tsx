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
        'ui-feedback ui-feedback--danger',
        className,
      )}
      role="alert"
    >
      <h2 class="ui-feedback__title" id={titleId}>
        {title}
      </h2>
      <p class="ui-feedback__description">{description}</p>
      {action ? <div class="mt-5">{action}</div> : null}
    </section>
  );
}
