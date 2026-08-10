import type { ComponentChildren, JSX } from 'preact';

import { classNames } from '@/components/ui/classNames';

interface ListRowProps extends Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  'class'
> {
  aside?: ComponentChildren;
  children: ComponentChildren;
  class?: string;
}

export function ListRow({
  aside,
  children,
  class: className,
  ...rowProps
}: ListRowProps) {
  return (
    <div {...rowProps} class={classNames('ui-list-row', className)}>
      <div class="ui-list-row__content">{children}</div>
      {aside ? <div class="ui-list-row__aside">{aside}</div> : null}
    </div>
  );
}
