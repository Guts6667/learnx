import { classNames } from '@/components/ui/classNames';

type SpinnerSize = 'sm' | 'md' | 'lg';

interface SpinnerProps {
  class?: string;
  label?: string;
  size?: SpinnerSize;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'size-4 border-2',
  md: 'size-6 border-2',
  lg: 'size-8 border-[3px]',
};

export function Spinner({
  class: className,
  label = 'Chargement',
  size = 'md',
}: SpinnerProps) {
  return (
    <span
      aria-label={label}
      class={classNames(
        'inline-block animate-spin rounded-full border-current border-r-transparent',
        sizeClasses[size],
        className,
      )}
      role="status"
    >
      <span class="sr-only">{label}</span>
    </span>
  );
}
