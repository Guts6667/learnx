import { classNames } from '@/components/ui/classNames';
import { useI18n } from '@/i18n';

interface SkeletonProps {
  className?: string;
  label?: string;
}

export function Skeleton({ className, label }: SkeletonProps) {
  const { t } = useI18n();
  const accessibleLabel = label ?? t('common.loadingContent');
  return (
    <div
      aria-label={accessibleLabel}
      className={classNames('animate-pulse space-y-4', className)}
      role="status"
    >
      <span className="sr-only">{accessibleLabel}</span>
      <div className="ui-skeleton-line h-5 w-2/5" />
      <div className="ui-skeleton-line h-4 w-full" />
      <div className="ui-skeleton-line h-4 w-4/5" />
      <div className="ui-skeleton-block h-24 w-full" />
    </div>
  );
}
