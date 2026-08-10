import type { ComponentChildren } from 'preact';

import { classNames } from '@/components/ui/classNames';

export interface MetadataItem {
  label: string;
  value: ComponentChildren;
  visuallyHiddenLabel?: boolean;
}

interface MetadataProps {
  class?: string;
  items: MetadataItem[];
}

export function Metadata({ class: className, items }: MetadataProps) {
  return (
    <dl class={classNames('ui-metadata', className)}>
      {items.map((item, index) => (
        <div class="ui-metadata__item" key={`${item.label}-${index}`}>
          <dt
            class={classNames(
              'ui-metadata__label',
              item.visuallyHiddenLabel && 'sr-only',
            )}
          >
            {item.label}
          </dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
