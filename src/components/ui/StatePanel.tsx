import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';

import { classNames } from '@/components/ui/classNames';
import { Spinner } from '@/components/ui/Spinner';

export type StatePanelStatus = 'empty' | 'loading' | 'error' | 'safe';

interface StatePanelProps {
  action?: ComponentChildren;
  children: ComponentChildren;
  class?: string;
  status: StatePanelStatus;
  title: string;
}

/** Shared empty/loading/error/safe state with explicit text and semantics. */
export function StatePanel({
  action,
  children,
  class: className,
  status,
  title,
}: StatePanelProps) {
  const titleId = useId();
  const isLoading = status === 'loading';
  const role = status === 'error' ? 'alert' : 'status';

  return (
    <section
      aria-busy={isLoading || undefined}
      aria-labelledby={titleId}
      class={classNames(
        'ui-state-panel',
        `ui-state-panel--${status}`,
        className,
      )}
      role={role}
    >
      {isLoading ? (
        <Spinner class="ui-state-panel__spinner" isDecorative />
      ) : null}
      <div class="min-w-0">
        <h2 class="ui-state-panel__title" id={titleId}>
          {title}
        </h2>
        <div class="ui-state-panel__content">{children}</div>
        {action ? <div class="ui-state-panel__action">{action}</div> : null}
      </div>
    </section>
  );
}
