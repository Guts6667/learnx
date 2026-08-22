import type { ComponentChildren, JSX } from 'preact';

import { classNames } from '@/components/ui/classNames';

interface ConsentGroupProps extends Omit<
  JSX.HTMLAttributes<HTMLFieldSetElement>,
  'class'
> {
  children: ComponentChildren;
  class?: string;
  description?: string;
  legend: string;
}

/** Keeps legally distinct choices visually and semantically independent. */
export function ConsentGroup({
  children,
  class: className,
  description,
  legend,
  ...props
}: ConsentGroupProps) {
  return (
    <fieldset {...props} class={classNames('ui-consent-group', className)}>
      <legend class="ui-consent-group__legend">{legend}</legend>
      {description ? (
        <p class="ui-consent-group__description">{description}</p>
      ) : null}
      <div class="ui-consent-group__items">{children}</div>
    </fieldset>
  );
}
