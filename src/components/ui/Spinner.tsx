import { classNames } from '@/components/ui/classNames';
import { useI18n } from '@/i18n';

type SpinnerSize = 'sm' | 'md' | 'lg';

interface SpinnerProps {
  className?: string;
  isDecorative?: boolean;
  label?: string;
  size?: SpinnerSize;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'size-4 border-2',
  md: 'size-6 border-2',
  lg: 'size-8 border-[3px]',
};

export function Spinner({
  className,
  isDecorative = false,
  label,
  size = 'md',
}: SpinnerProps) {
  const { t } = useI18n();
  const accessibleLabel = label ?? t('common.loading');
  return (
    <span
      aria-hidden={isDecorative || undefined}
      aria-label={isDecorative ? undefined : accessibleLabel}
      className={classNames(
        'inline-block animate-spin rounded-full border-current border-r-transparent',
        sizeClasses[size],
        className,
      )}
      role={isDecorative ? undefined : 'status'}
    >
      {isDecorative ? null : <span className="sr-only">{accessibleLabel}</span>}
    </span>
  );
}
