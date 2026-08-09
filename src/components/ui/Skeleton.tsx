import { classNames } from '@/components/ui/classNames';
import { useI18n } from '@/i18n';

interface SkeletonProps {
  class?: string;
  label?: string;
}

export function Skeleton({
  class: className,
  label,
}: SkeletonProps) {
  const { t } = useI18n();
  const accessibleLabel = label ?? t('common.loadingContent');
  return (
    <div
      aria-label={accessibleLabel}
      class={classNames('animate-pulse space-y-4', className)}
      role="status"
    >
      <span class="sr-only">{accessibleLabel}</span>
      <div class="h-5 w-2/5 rounded-full bg-slate-800" />
      <div class="h-4 w-full rounded-full bg-slate-800" />
      <div class="h-4 w-4/5 rounded-full bg-slate-800" />
      <div class="h-24 w-full rounded-2xl bg-slate-900" />
    </div>
  );
}
