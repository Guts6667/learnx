import type { ComponentChildren, JSX } from 'preact';

import {
  actionClassNames,
  type ActionSize,
  type ActionVariant,
} from '@/components/ui/actionStyles';

interface NavigationActionProps extends Omit<
  JSX.AnchorHTMLAttributes<HTMLAnchorElement>,
  'class' | 'href' | 'onClick' | 'role'
> {
  children: ComponentChildren;
  class?: string;
  href: string;
  size?: ActionSize;
  variant?: Exclude<ActionVariant, 'danger'>;
}

export function NavigationAction({
  children,
  class: className,
  href,
  size = 'md',
  variant = 'primary',
  ...anchorProps
}: NavigationActionProps) {
  return (
    <a
      {...anchorProps}
      class={actionClassNames(variant, size, className)}
      href={href}
    >
      {children}
    </a>
  );
}
