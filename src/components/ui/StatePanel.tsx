import type { ReactNode } from 'react';
import { useId } from 'react';

import { classNames } from '@/components/ui/classNames';
import { Spinner } from '@/components/ui/Spinner';

type StatePanelStatus =
  | 'empty'
  | 'error'
  | 'forbidden'
  | 'loading'
  | 'safe'
  | 'success'
  | 'unavailable';

interface StatePanelProps {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  status: StatePanelStatus;
  title: string;
}

/** Shared empty/loading/error/safe state with explicit text and semantics. */
export function StatePanel({
  action,
  children,
  className,
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
      className={classNames(
        'ui-state-panel',
        `ui-state-panel--${status}`,
        className,
      )}
      role={role}
    >
      {isLoading ? (
        <Spinner className="ui-state-panel__spinner" isDecorative />
      ) : null}
      <div className="min-w-0">
        <h2 className="ui-state-panel__title" id={titleId}>
          {title}
        </h2>
        <div className="ui-state-panel__content">{children}</div>
        {action ? <div className="ui-state-panel__action">{action}</div> : null}
      </div>
    </section>
  );
}
