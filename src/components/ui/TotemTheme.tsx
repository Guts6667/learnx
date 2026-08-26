import type { HTMLAttributes, ReactNode } from 'react';

import { classNames } from '@/components/ui/classNames';

interface TotemThemeProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'className'
> {
  children: ReactNode;
  className?: string;
}

/**
 * Opt-in boundary for the Totem visual language.
 *
 * Screens migrate explicitly by wrapping their root with this component. The
 * Atlas aliases remain untouched outside this boundary, which keeps rollback
 * local and prevents a partial migration from changing unrelated routes.
 */
export function TotemTheme({ children, className, ...props }: TotemThemeProps) {
  return (
    <div
      {...props}
      className={classNames('totem-theme', className)}
      data-visual-system="totem"
    >
      {children}
    </div>
  );
}
