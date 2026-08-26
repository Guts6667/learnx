import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

import { classNames } from '@/components/ui/classNames';

interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className' | 'id' | 'type'
> {
  className?: string;
  description?: string;
  error?: string;
  id?: string;
  label: string;
}

export function Checkbox({
  className,
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
    <div className={classNames('ui-field', className)}>
      <div className="flex items-start gap-3">
        <input
          {...inputProps}
          aria-describedby={messageId}
          aria-invalid={Boolean(error) || undefined}
          className="ui-checkbox mt-0.5"
          id={inputId}
          type="checkbox"
        />
        <label className="ui-field__label leading-5" htmlFor={inputId}>
          {label}
        </label>
      </div>
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
