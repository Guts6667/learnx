import type { HTMLAttributes, ReactNode } from 'react';

import { classNames } from '@/components/ui/classNames';

interface SectionProps extends Omit<
  HTMLAttributes<HTMLElement>,
  'className' | 'title'
> {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  title?: ReactNode;
}

export function Section({
  action,
  children,
  className,
  description,
  title,
  ...sectionProps
}: SectionProps) {
  return (
    <section {...sectionProps} className={classNames('ui-section', className)}>
      {title || description || action ? (
        <header className="mb-4 flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            {title ? <h2 className="text-lg font-medium">{title}</h2> : null}
            {description ? (
              <div className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
                {description}
              </div>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
