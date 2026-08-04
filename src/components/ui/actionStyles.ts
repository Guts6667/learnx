import { classNames } from '@/components/ui/classNames';

export type ActionSize = 'sm' | 'md' | 'lg';
export type ActionVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variantClasses: Record<ActionVariant, string> = {
  danger: 'bg-red-500 text-white hover:bg-red-400',
  ghost: 'bg-transparent text-slate-200 hover:bg-slate-800',
  primary: 'bg-cyan-400 text-slate-950 hover:bg-cyan-300',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700',
};

const sizeClasses: Record<ActionSize, string> = {
  lg: 'min-h-12 px-5 py-3 text-base',
  md: 'min-h-11 px-4 py-2.5 text-sm',
  sm: 'min-h-11 px-3 py-2 text-sm',
};

export function actionClassNames(
  variant: ActionVariant,
  size: ActionSize,
  className?: string,
): string {
  return classNames(
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400',
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}
