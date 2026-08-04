import { classNames } from '@/components/ui/classNames';

interface SkeletonProps {
  class?: string;
  label?: string;
}

export function Skeleton({
  class: className,
  label = 'Chargement du contenu',
}: SkeletonProps) {
  return (
    <div
      aria-label={label}
      class={classNames('animate-pulse space-y-4', className)}
      role="status"
    >
      <span class="sr-only">{label}</span>
      <div class="h-5 w-2/5 rounded-full bg-slate-800" />
      <div class="h-4 w-full rounded-full bg-slate-800" />
      <div class="h-4 w-4/5 rounded-full bg-slate-800" />
      <div class="h-24 w-full rounded-2xl bg-slate-900" />
    </div>
  );
}
