import { useId } from 'preact/hooks';
import type { JSX } from 'preact';

import { classNames } from '@/components/ui/classNames';

interface TextareaProps extends Omit<
  JSX.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'class' | 'id'
> {
  class?: string;
  description?: string;
  error?: string;
  id?: string;
  label: string;
}

export function Textarea({
  class: className,
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
    <div class={classNames('ui-field', className)}>
      <label class="ui-field__label" for={textareaId}>
        {label}
      </label>
      <textarea
        {...textareaProps}
        aria-describedby={messageId}
        aria-invalid={Boolean(error) || undefined}
        class="ui-field__control min-h-28 resize-y"
        id={textareaId}
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
