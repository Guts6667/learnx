import { classNames } from '@/components/ui/classNames';

export type ActionSize = 'sm' | 'md' | 'lg';
export type ActionVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variantClasses: Record<ActionVariant, string> = {
  danger: 'ui-action--danger',
  ghost: 'ui-action--ghost',
  primary: 'ui-action--primary',
  secondary: 'ui-action--secondary',
};

const sizeClasses: Record<ActionSize, string> = {
  lg: 'ui-action--lg',
  md: 'ui-action--md',
  sm: 'ui-action--sm',
};

export function actionClassNames(
  variant: ActionVariant,
  size: ActionSize,
  className?: string,
): string {
  return classNames(
    'ui-action',
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}
