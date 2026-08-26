import { cva } from 'class-variance-authority';

export type ActionSize = 'sm' | 'md' | 'lg';
export type ActionVariant =
  'primary' | 'secondary' | 'editorial' | 'ghost' | 'danger';

export const actionVariants = cva('ui-action', {
  defaultVariants: {
    size: 'md',
    variant: 'primary',
  },
  variants: {
    size: {
      lg: 'ui-action--lg',
      md: 'ui-action--md',
      sm: 'ui-action--sm',
    } satisfies Record<ActionSize, string>,
    variant: {
      danger: 'ui-action--danger',
      editorial: 'ui-action--editorial',
      ghost: 'ui-action--ghost',
      primary: 'ui-action--primary',
      secondary: 'ui-action--secondary',
    } satisfies Record<ActionVariant, string>,
  },
});

export function actionClassNames(
  variant: ActionVariant,
  size: ActionSize,
  className?: string,
): string {
  return actionVariants({ className, size, variant });
}
