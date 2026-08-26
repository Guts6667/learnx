import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

import {
  actionClassNames,
  type ActionSize,
  type ActionVariant,
} from '@/components/ui/actionStyles';
import { Spinner } from '@/components/ui/Spinner';
import { useI18n } from '@/i18n';

interface ButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'className' | 'disabled'
> {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  elementRef?: Ref<HTMLButtonElement>;
  isLoading?: boolean;
  size?: ActionSize;
  variant?: ActionVariant;
}

export function Button({
  children,
  className,
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
      className={actionClassNames(variant, size, className)}
      disabled={isDisabled}
      ref={elementRef}
      type={type ?? 'button'}
    >
      {isLoading ? <Spinner label={t('common.loading')} size="sm" /> : null}
      {children}
    </button>
  );
}
