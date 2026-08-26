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
  const message = error ?? description;
  const messageId = message ? `${textareaId}-message` : undefined;

  return (
    <div className={classNames('ui-field', className)}>
      <label className="ui-field__label" htmlFor={textareaId}>
        {label}
      </label>
      <textarea
        {...textareaProps}
        aria-describedby={messageId}
        aria-invalid={Boolean(error) || undefined}
        className="ui-field__control min-h-28 resize-y"
        id={textareaId}
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
