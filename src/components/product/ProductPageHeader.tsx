import type { ReactNode } from 'react';

interface ProductPageHeaderFact {
  label: string;
  value: ReactNode;
}

interface ProductPageHeaderSummary {
  description?: string;
  eyebrow: string;
  facts?: ProductPageHeaderFact[];
  title: string;
}

interface ProductPageHeaderProps {
  description?: string;
  eyebrow: string;
  id: string;
  summary?: ProductPageHeaderSummary;
  title: string;
}

export function ProductPageHeader({
  description,
  eyebrow,
  id,
  summary,
  title,
}: ProductPageHeaderProps) {
  return (
    <header className="totem-product-page-head">
      <div className="totem-product-page-head__intro">
        <p className="totem-kicker">{eyebrow}</p>
        <h1 className="page-title" id={id}>
          {title}
        </h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {summary ? (
        <aside className="totem-product-page-summary">
          <p className="totem-kicker">{summary.eyebrow}</p>
          <strong>{summary.title}</strong>
          {summary.description ? <p>{summary.description}</p> : null}
          {summary.facts?.length ? (
            <dl className="totem-product-page-summary__facts">
              {summary.facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </aside>
      ) : null}
    </header>
  );
}
