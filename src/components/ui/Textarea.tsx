import { useId } from 'react';
import type { TextareaHTMLAttributes } from 'react';

import { classNames } from '@/components/ui/classNames';

interface TextareaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'className' | 'id'
> {
  className?: string;
  description?: string;
  error?: string;
  id?: string;
  label: string;
}

export function Textarea({
  className,
  description,
  error,
  id,
  label,
  ...textareaProps
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const descriptionId = description ? `${textareaId}-description` : undefined;
  const errorId = error ? `${textareaId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ');

  return (
    <div className={classNames('ui-field', className)}>
      <label className="ui-field__label" htmlFor={textareaId}>
        {label}
      </label>
      <textarea
        {...textareaProps}
        aria-describedby={describedBy || undefined}
        aria-invalid={Boolean(error) || undefined}
        className="ui-field__control min-h-28 resize-y"
        id={textareaId}
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
