import type { HTMLAttributes, ReactNode } from 'react';

import { classNames } from '@/components/ui/classNames';

interface ListRowProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'className'
> {
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ListRow({
  aside,
  children,
  className,
  ...rowProps
}: ListRowProps) {
  return (
    <div {...rowProps} className={classNames('ui-list-row', className)}>
      <div className="ui-list-row__content">{children}</div>
      {aside ? <div className="ui-list-row__aside">{aside}</div> : null}
    </div>
  );
}
