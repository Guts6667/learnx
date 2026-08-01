import type { ComponentChildren } from 'preact';

import { classNames } from '@/components/ui/classNames';

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  children: ComponentChildren;
  class?: string;
  tone?: BadgeTone;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-slate-800 text-slate-200',
  info: 'bg-cyan-950 text-cyan-200',
  success: 'bg-emerald-950 text-emerald-200',
  warning: 'bg-amber-950 text-amber-200',
  danger: 'bg-red-950 text-red-200',
};

export function Badge({
  children,
  class: className,
  tone = 'neutral',
}: BadgeProps) {
  return (
    <span
      class={classNames(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
