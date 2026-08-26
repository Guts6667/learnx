import type { ReactNode } from 'react';

import { classNames } from '@/components/ui/classNames';

export interface MetadataItem {
  label: string;
  value: ReactNode;
  visuallyHiddenLabel?: boolean;
}

interface MetadataProps {
  className?: string;
  items: MetadataItem[];
}

export function Metadata({ className, items }: MetadataProps) {
  return (
    <dl className={classNames('ui-metadata', className)}>
      {items.map((item, index) => (
        <div className="ui-metadata__item" key={`${item.label}-${index}`}>
          <dt
            className={classNames(
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
