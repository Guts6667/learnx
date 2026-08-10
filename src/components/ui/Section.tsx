import type { ComponentChildren, JSX } from 'preact';

import { classNames } from '@/components/ui/classNames';

interface SectionProps extends Omit<
  JSX.HTMLAttributes<HTMLElement>,
  'class' | 'title'
> {
  action?: ComponentChildren;
  children: ComponentChildren;
  class?: string;
  description?: ComponentChildren;
  title?: ComponentChildren;
}

export function Section({
  action,
  children,
  class: className,
  description,
  title,
  ...sectionProps
}: SectionProps) {
  return (
    <section {...sectionProps} class={classNames('ui-section', className)}>
      {title || description || action ? (
        <header class="mb-4 flex min-w-0 items-start justify-between gap-4">
          <div class="min-w-0">
            {title ? <h2 class="text-lg font-medium">{title}</h2> : null}
            {description ? (
              <div class="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
                {description}
              </div>
            ) : null}
          </div>
          {action ? <div class="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
