import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

import { classNames } from '@/components/ui/classNames';

interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className' | 'id'
> {
  className?: string;
  description?: string;
  error?: string;
  id?: string;
  label: string;
}

export function TextField({
  className,
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
    <div className={classNames('ui-field', className)}>
      <label className="ui-field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        {...inputProps}
        aria-describedby={messageId}
        aria-invalid={Boolean(error) || undefined}
        className="ui-field__control"
        id={inputId}
      />
      {message ? (
        <p
          className={classNames(
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
