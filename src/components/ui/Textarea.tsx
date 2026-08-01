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
    <div class={classNames('space-y-2', className)}>
      <label class="block text-sm font-medium text-slate-200" for={textareaId}>
        {label}
      </label>
      <textarea
        {...textareaProps}
        aria-describedby={messageId}
        aria-invalid={Boolean(error) || undefined}
        class={classNames(
          'min-h-28 w-full resize-y rounded-xl border bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-2 focus:outline-offset-2 focus:outline-cyan-400',
          error ? 'border-red-400' : 'border-slate-700',
        )}
        id={textareaId}
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
