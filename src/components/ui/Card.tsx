import type { HTMLAttributes, ReactNode } from 'react';

import { classNames } from '@/components/ui/classNames';

type CardTone = 'default' | 'accent' | 'muted' | 'signature';

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className'> {
  children: ReactNode;
  className?: string;
  tone?: CardTone;
}

const toneClasses: Record<CardTone, string> = {
  default: '',
  accent: 'ui-card--accent',
  muted: 'ui-card--muted',
  signature: 'ui-card--signature',
};

export function Card({
  children,
  className,
  tone = 'default',
  ...props
}: CardProps) {
  return (
    <div
      {...props}
      className={classNames('ui-card p-5 sm:p-6', toneClasses[tone], className)}
    >
      {children}
    </div>
  );
}
