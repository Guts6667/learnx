import { classNames } from '@/components/ui/classNames';

interface ProgressBarProps {
  className?: string;
  label: string;
  max?: number;
  showValue?: boolean;
  value: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function ProgressBar({
  className,
  label,
  max = 100,
  showValue = true,
  value,
}: ProgressBarProps) {
  const safeMax = Math.max(max, 1);
  const safeValue = clamp(value, 0, safeMax);
  const percentage = (safeValue / safeMax) * 100;

  return (
    <div className={classNames('space-y-2', className)}>
      <div className="ui-progress__header">
        <span className="ui-progress__label">{label}</span>
        {showValue ? (
          <span className="ui-progress__value">{Math.round(percentage)} %</span>
        ) : null}
      </div>
      <div
        aria-label={label}
        aria-valuemax={safeMax}
        aria-valuemin={0}
        aria-valuenow={safeValue}
        className="ui-progress__track"
        role="progressbar"
      >
        <div className="ui-progress__bar" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
