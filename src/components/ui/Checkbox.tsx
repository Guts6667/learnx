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
    <div class={classNames('ui-field', className)}>
      <div class="flex items-start gap-3">
        <input
          {...inputProps}
          aria-describedby={messageId}
          aria-invalid={Boolean(error) || undefined}
          class="ui-checkbox mt-0.5"
          id={inputId}
          type="checkbox"
        />
        <label class="ui-field__label leading-5" for={inputId}>
          {label}
        </label>
      </div>
      {message ? (
        <p
          class={classNames(
            'ui-field__message',
            error && 'ui-field__message--error',
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
