import { Slot, Slottable } from '@radix-ui/react-slot';
import {
  Children,
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';

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

interface InteractiveChildProps {
  href?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  tabIndex?: number;
}

function blockDisabledClick(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

function blockDisabledKeyDown(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  event.stopPropagation();
}

export function Button({
  asChild = false,
  children,
  className,
  disabled = false,
  elementRef,
  isLoading = false,
  onClick,
  onKeyDown,
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
    if (isDisabled) {
      const child = Children.only(children);
      if (!isValidElement(child)) {
        throw new TypeError('Button asChild expects one React element.');
      }
      const disabledChild = cloneElement(
        child as ReactElement<InteractiveChildProps>,
        {
          href: undefined,
          onClick: blockDisabledClick,
          onKeyDown: blockDisabledKeyDown,
          tabIndex: -1,
        },
      );

      return (
        <Slot
          {...buttonProps}
          aria-busy={isLoading || undefined}
          aria-disabled="true"
          className={actionClassNames(variant, size, className)}
          data-disabled="true"
          onClick={blockDisabledClick}
          onKeyDown={blockDisabledKeyDown}
        >
          {isLoading ? <Spinner label={t('common.loading')} size="sm" /> : null}
          <Slottable>{disabledChild}</Slottable>
        </Slot>
      );
    }

    return (
      <Slot
        {...buttonProps}
        aria-busy={isLoading || undefined}
        aria-disabled={isDisabled || undefined}
        className={actionClassNames(variant, size, className)}
        data-disabled={isDisabled || undefined}
        onClick={onClick}
        onKeyDown={onKeyDown}
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
      onClick={onClick}
      onKeyDown={onKeyDown}
      ref={elementRef}
      type={type ?? 'button'}
    >
      {content}
    </button>
  );
}
