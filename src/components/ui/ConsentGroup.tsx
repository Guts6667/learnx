import type { HTMLAttributes, ReactNode } from 'react';

import { classNames } from '@/components/ui/classNames';

interface ConsentGroupProps extends Omit<
  HTMLAttributes<HTMLFieldSetElement>,
  'className'
> {
  children: ReactNode;
  className?: string;
  description?: string;
  legend: string;
}

/** Keeps legally distinct choices visually and semantically independent. */
export function ConsentGroup({
  children,
  className,
  description,
  legend,
  ...props
}: ConsentGroupProps) {
  return (
    <fieldset {...props} className={classNames('ui-consent-group', className)}>
      <legend className="ui-consent-group__legend">{legend}</legend>
      {description ? (
        <p className="ui-consent-group__description">{description}</p>
      ) : null}
      <div className="ui-consent-group__items">{children}</div>
    </fieldset>
  );
}
