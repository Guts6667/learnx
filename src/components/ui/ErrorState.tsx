import type { ReactNode } from 'react';
import { useId } from 'react';

import { classNames } from '@/components/ui/classNames';

interface ErrorStateProps {
  action?: ReactNode;
  className?: string;
  description: string;
  title?: string;
}

export function ErrorState({
  action,
  className,
  description,
  title = 'Une erreur est survenue',
}: ErrorStateProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={classNames('ui-feedback ui-feedback--danger', className)}
      role="alert"
    >
      <h2 className="ui-feedback__title" id={titleId}>
        {title}
      </h2>
      <p className="ui-feedback__description">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
