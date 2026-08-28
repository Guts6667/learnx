import type { HTMLAttributes, ReactNode } from 'react';

import { classNames } from '@/components/ui/classNames';

interface LessonActivitySurfaceProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'className'
> {
  children: ReactNode;
  className?: string;
}

export function LessonActivitySurface({
  children,
  className,
  ...props
}: LessonActivitySurfaceProps) {
  return (
    <div
      {...props}
      className={classNames('lesson-activity-surface', className)}
    >
      {children}
    </div>
  );
}
