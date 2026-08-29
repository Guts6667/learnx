import type { ReactNode } from 'react';
import { useId } from 'react';

import { classNames } from '@/components/ui/classNames';

interface ErrorStateProps {
  action?: ReactNode;
  className?: string;
  description: string;
  /** Use 1 only when this state replaces the whole routed view. */
  headingLevel?: 1 | 2;
  title?: string;
}

export function ErrorState({
  action,
  className,
  description,
  headingLevel = 2,
  title = 'Une erreur est survenue',
}: ErrorStateProps) {
  const titleId = useId();
  const Heading = `h${headingLevel}` as const;

  return (
    <section
      aria-labelledby={titleId}
      className={classNames('ui-feedback ui-feedback--danger', className)}
      role="alert"
    >
      <Heading className="ui-feedback__title" id={titleId}>
        {title}
      </Heading>
      <p className="ui-feedback__description">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
