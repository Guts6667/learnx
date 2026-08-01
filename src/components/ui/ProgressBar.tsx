import { classNames } from '@/components/ui/classNames';

interface ProgressBarProps {
  class?: string;
  label: string;
  max?: number;
  showValue?: boolean;
  value: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function ProgressBar({
  class: className,
  label,
  max = 100,
  showValue = true,
  value,
}: ProgressBarProps) {
  const safeMax = Math.max(max, 1);
  const safeValue = clamp(value, 0, safeMax);
  const percentage = (safeValue / safeMax) * 100;

  return (
    <div class={classNames('space-y-2', className)}>
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm font-medium text-slate-200">{label}</span>
        {showValue ? (
          <span class="text-sm tabular-nums text-slate-400">
            {Math.round(percentage)} %
          </span>
        ) : null}
      </div>
      <div
        aria-label={label}
        aria-valuemax={safeMax}
        aria-valuemin={0}
        aria-valuenow={safeValue}
        class="h-2.5 overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
      >
        <div
          class="h-full rounded-full bg-cyan-400 transition-[width] duration-200"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
