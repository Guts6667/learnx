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
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ');

  return (
    <div className={classNames('ui-field', className)}>
      <label className="ui-field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        {...inputProps}
        aria-describedby={describedBy || undefined}
        aria-invalid={Boolean(error) || undefined}
        className="ui-field__control"
        id={inputId}
      />
      {description ? (
        <p className="ui-field__message" id={descriptionId}>
          {description}
        </p>
      ) : null}
      {error ? (
        <p
          className="ui-field__message ui-field__message--error"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
