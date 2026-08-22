import type { ComponentChildren, JSX } from 'preact';
import { useId } from 'preact/hooks';

import { classNames } from '@/components/ui/classNames';

export type NoticeTone = 'info' | 'attention' | 'safe' | 'danger';

interface NoticeProps extends Omit<
  JSX.HTMLAttributes<HTMLElement>,
  'class' | 'title'
> {
  children: ComponentChildren;
  class?: string;
  title: string;
  tone?: NoticeTone;
}

const toneClasses: Record<NoticeTone, string> = {
  attention: 'ui-notice--attention',
  danger: 'ui-notice--danger',
  info: 'ui-notice--info',
  safe: 'ui-notice--safe',
};

/** A labelled status surface whose meaning never depends on colour alone. */
export function Notice({
  children,
  class: className,
  title,
  tone = 'info',
  ...props
}: NoticeProps) {
  const titleId = useId();
  const liveRole = tone === 'danger' ? 'alert' : 'status';

  return (
    <section
      {...props}
      aria-labelledby={titleId}
      class={classNames('ui-notice', toneClasses[tone], className)}
      role={liveRole}
    >
      <span aria-hidden="true" class="ui-notice__marker" />
      <div class="min-w-0">
        <h3 class="ui-notice__title" id={titleId}>
          {title}
        </h3>
        <div class="ui-notice__content">{children}</div>
      </div>
    </section>
  );
}
