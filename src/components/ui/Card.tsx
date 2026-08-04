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
  accent: 'border-cyan-800/80 bg-cyan-950/25',
  muted: 'bg-slate-900/60 shadow-none',
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
