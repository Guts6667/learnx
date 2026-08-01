import type { ComponentChildren, JSX } from 'preact';

import { classNames } from '@/components/ui/classNames';

interface CardProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'class'> {
  children: ComponentChildren;
  class?: string;
}

export function Card({ children, class: className, ...props }: CardProps) {
  return (
    <div
      {...props}
      class={classNames(
        'rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-slate-950/30',
        className,
      )}
    >
      {children}
    </div>
  );
}
