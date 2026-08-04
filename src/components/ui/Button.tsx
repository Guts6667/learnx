import type { ComponentChildren, JSX, Ref } from 'preact';

import { classNames } from '@/components/ui/classNames';
import { Spinner } from '@/components/ui/Spinner';

type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  'class' | 'disabled'
> {
  children: ComponentChildren;
  class?: string;
  disabled?: boolean;
  elementRef?: Ref<HTMLButtonElement>;
  isLoading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-cyan-400 text-slate-950 hover:bg-cyan-300',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700',
  ghost: 'bg-transparent text-slate-200 hover:bg-slate-800',
  danger: 'bg-red-500 text-white hover:bg-red-400',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-3 py-2 text-sm',
  md: 'min-h-11 px-4 py-2.5 text-sm',
  lg: 'min-h-12 px-5 py-3 text-base',
};

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
      class={classNames(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
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
