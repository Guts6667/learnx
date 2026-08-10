import type { ComponentChildren, JSX, Ref } from 'preact';

import {
  actionClassNames,
  type ActionSize,
  type ActionVariant,
} from '@/components/ui/actionStyles';
import { Spinner } from '@/components/ui/Spinner';
import { useI18n } from '@/i18n';

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
  const { t } = useI18n();

  return (
    <button
      {...buttonProps}
      aria-busy={isLoading || undefined}
      class={actionClassNames(
        variant,
        size,
        className,
      )}
      disabled={isDisabled}
      ref={elementRef}
      type={type ?? 'button'}
    >
      {isLoading ? <Spinner label={t('common.loading')} size="sm" /> : null}
      {children}
    </button>
  );
}
