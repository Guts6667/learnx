import type { ReactNode } from 'react';

interface ProductRailProps {
  action?: ReactNode;
  children: ReactNode;
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
    <aside aria-labelledby={id} className="totem-product-rail">
      <p className="totem-kicker">{eyebrow}</p>
      <h2 className="totem-product-rail__title" id={id}>
        {title}
      </h2>
      {description ? (
        <p className="totem-product-rail__description">{description}</p>
      ) : null}
      <div className="totem-product-rail__content">{children}</div>
      {action ? (
        <div className="totem-product-rail__action">{action}</div>
      ) : null}
    </aside>
  );
}
