import { Slot, Slottable } from '@radix-ui/react-slot';
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
  asChild?: boolean;
  className?: string;
  disabled?: boolean;
  elementRef?: Ref<HTMLButtonElement>;
  isLoading?: boolean;
  size?: ActionSize;
  variant?: ActionVariant;
}

export function Button({
  asChild = false,
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
  const content = (
    <>
      {isLoading ? <Spinner label={t('common.loading')} size="sm" /> : null}
      {children}
    </>
  );

  if (asChild) {
    return (
      <Slot
        {...buttonProps}
        aria-busy={isLoading || undefined}
        aria-disabled={isDisabled || undefined}
        className={actionClassNames(variant, size, className)}
        data-disabled={isDisabled || undefined}
      >
        {isLoading ? <Spinner label={t('common.loading')} size="sm" /> : null}
        <Slottable>{children}</Slottable>
      </Slot>
    );
  }

  return (
    <button
      {...buttonProps}
      aria-busy={isLoading || undefined}
      className={actionClassNames(variant, size, className)}
      disabled={isDisabled}
      ref={elementRef}
      type={type ?? 'button'}
    >
      {content}
    </button>
  );
}
