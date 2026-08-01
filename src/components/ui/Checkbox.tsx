import { useId } from 'preact/hooks';
import type { JSX } from 'preact';

import { classNames } from '@/components/ui/classNames';

interface CheckboxProps extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  'class' | 'id' | 'type'
> {
  class?: string;
  description?: string;
  error?: string;
  id?: string;
  label: string;
}

export function Checkbox({
  class: className,
  description,
  error,
  id,
  label,
  ...inputProps
}: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const message = error ?? description;
  const messageId = message ? `${inputId}-message` : undefined;

  return (
    <div class={classNames('space-y-2', className)}>
      <div class="flex items-start gap-3">
        <input
          {...inputProps}
          aria-describedby={messageId}
          aria-invalid={Boolean(error) || undefined}
          class="mt-0.5 size-5 shrink-0 rounded border-slate-600 bg-slate-950 text-cyan-400 focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-950"
          id={inputId}
          type="checkbox"
        />
        <label class="text-sm leading-5 text-slate-200" for={inputId}>
          {label}
        </label>
      </div>
      {message ? (
        <p
          class={classNames(
            'text-sm',
            error ? 'text-red-300' : 'text-slate-400',
          )}
          id={messageId}
          role={error ? 'alert' : undefined}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
