import type { ReactNode } from 'react';

import { classNames } from '@/components/ui/classNames';

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  children: ReactNode;
  className?: string;
  tone?: BadgeTone;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'ui-badge--neutral',
  info: 'ui-badge--info',
  success: 'ui-badge--success',
  warning: 'ui-badge--warning',
  danger: 'ui-badge--danger',
};

export function Badge({ children, className, tone = 'neutral' }: BadgeProps) {
  return (
    <span className={classNames('ui-badge', toneClasses[tone], className)}>
      {children}
    </span>
  );
}
