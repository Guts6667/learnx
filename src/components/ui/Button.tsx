import type { ComponentChildren, JSX, Ref } from 'preact';

import {
  actionClassNames,
  type ActionSize,
  type ActionVariant,
} from '@/components/ui/actionStyles';
import { Spinner } from '@/components/ui/Spinner';

interface ButtonProps extends Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  'class' | 'disabled'
> {
  children: ComponentChildren;
  class?: string;
  disabled?: boolean;
  elementRef?: Ref<HTMLButtonElement>;
  isLoading?: boolean;
  size?: ActionSize;
  variant?: ActionVariant;
}

export function Button({
  children,
  class: className,
  disabled = false,
  elementRef,
  isLoading = false,
  size = 'md',
  type,
  variant = 'primary',
  ...buttonProps
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      {...buttonProps}
      aria-busy={isLoading || undefined}
      class={actionClassNames(
        variant,
        size,
        `disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ''}`,
      )}
      disabled={isDisabled}
      ref={elementRef}
      type={type ?? 'button'}
    >
      {isLoading ? <Spinner label="Chargement" size="sm" /> : null}
      {children}
    </button>
  );
}
