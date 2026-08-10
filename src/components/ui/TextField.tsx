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
    <div class={classNames('ui-field', className)}>
      <label class="ui-field__label" for={inputId}>
        {label}
      </label>
      <input
        {...inputProps}
        aria-describedby={messageId}
        aria-invalid={Boolean(error) || undefined}
        class="ui-field__control"
        id={inputId}
      />
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
