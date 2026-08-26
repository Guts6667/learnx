import type { AnchorHTMLAttributes, ReactNode } from 'react';

import {
  actionClassNames,
  type ActionSize,
  type ActionVariant,
} from '@/components/ui/actionStyles';

interface NavigationActionProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'className' | 'href' | 'onClick' | 'role'
> {
  children: ReactNode;
  className?: string;
  href: string;
  size?: ActionSize;
  variant?: Exclude<ActionVariant, 'danger'>;
}

export function NavigationAction({
  children,
  className,
  href,
  size = 'md',
  variant = 'primary',
  ...anchorProps
}: NavigationActionProps) {
  return (
    <a
      {...anchorProps}
      className={actionClassNames(variant, size, className)}
      href={href}
    >
      {children}
    </a>
  );
}
