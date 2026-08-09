import { classNames } from '@/components/ui/classNames';
import { useI18n } from '@/i18n';

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
  label,
  size = 'md',
}: SpinnerProps) {
  const { t } = useI18n();
  const accessibleLabel = label ?? t('common.loading');
  return (
    <span
      aria-label={accessibleLabel}
      class={classNames(
        'inline-block animate-spin rounded-full border-current border-r-transparent',
        sizeClasses[size],
        className,
      )}
      role="status"
    >
      <span class="sr-only">{accessibleLabel}</span>
    </span>
  );
}
