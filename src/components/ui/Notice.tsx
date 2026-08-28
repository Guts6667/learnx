import type { HTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';

import { classNames } from '@/components/ui/classNames';

type NoticeTone = 'info' | 'attention' | 'safe' | 'danger';

interface NoticeProps extends Omit<
  HTMLAttributes<HTMLElement>,
  'className' | 'title'
> {
  children: ReactNode;
  className?: string;
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
  className,
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
      className={classNames('ui-notice', toneClasses[tone], className)}
      role={liveRole}
    >
      <span aria-hidden="true" className="ui-notice__marker" />
      <div className="min-w-0">
        <h3 className="ui-notice__title" id={titleId}>
          {title}
        </h3>
        <div className="ui-notice__content">{children}</div>
      </div>
    </section>
  );
}
