import type { ComponentChildren, JSX } from 'preact';

import { classNames } from '@/components/ui/classNames';

type CardTone = 'default' | 'accent' | 'muted';

interface CardProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'class'> {
  children: ComponentChildren;
  class?: string;
  tone?: CardTone;
}

const toneClasses: Record<CardTone, string> = {
  default: '',
  accent: 'ui-card--accent',
  muted: 'ui-card--muted',
};

export function Card({
  children,
  class: className,
  tone = 'default',
  ...props
}: CardProps) {
  return (
    <div
      {...props}
      class={classNames('ui-card p-5 sm:p-6', toneClasses[tone], className)}
    >
      {children}
    </div>
  );
}
