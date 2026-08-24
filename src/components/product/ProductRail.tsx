import type { ComponentChildren } from 'preact';

interface ProductRailProps {
  action?: ComponentChildren;
  children: ComponentChildren;
  description?: string;
  eyebrow: string;
  id: string;
  title: string;
}

export function ProductRail({
  action,
  children,
  description,
  eyebrow,
  id,
  title,
}: ProductRailProps) {
  return (
    <aside aria-labelledby={id} class="totem-product-rail">
      <p class="totem-kicker">{eyebrow}</p>
      <h2 class="totem-product-rail__title" id={id}>
        {title}
      </h2>
      {description ? (
        <p class="totem-product-rail__description">{description}</p>
      ) : null}
      <div class="totem-product-rail__content">{children}</div>
      {action ? <div class="totem-product-rail__action">{action}</div> : null}
    </aside>
  );
}
