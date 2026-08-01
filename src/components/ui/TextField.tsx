import { useId } from 'preact/hooks';
import type { JSX } from 'preact';

import { classNames } from '@/components/ui/classNames';

interface TextFieldProps extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  'class' | 'id'
> {
  class?: string;
  description?: string;
  error?: string;
  id?: string;
  label: string;
}

export function TextField({
  class: className,
  description,
  error,
  id,
  label,
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const message = error ?? description;
  const messageId = message ? `${inputId}-message` : undefined;

  return (
    <div class={classNames('space-y-2', className)}>
      <label class="block text-sm font-medium text-slate-200" for={inputId}>
        {label}
      </label>
      <input
        {...inputProps}
        aria-describedby={messageId}
        aria-invalid={Boolean(error) || undefined}
        class={classNames(
          'min-h-11 w-full rounded-xl border bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-2 focus:outline-offset-2 focus:outline-cyan-400',
          error ? 'border-red-400' : 'border-slate-700',
        )}
        id={inputId}
      />
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
