import type { ComponentChildren } from 'preact';

interface ProductPageHeaderFact {
  label: string;
  value: ComponentChildren;
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
    <header class="totem-product-page-head">
      <div class="totem-product-page-head__intro">
        <p class="totem-kicker">{eyebrow}</p>
        <h1 class="page-title" id={id}>
          {title}
        </h1>
        {description ? <p class="page-description">{description}</p> : null}
      </div>
      {summary ? (
        <aside class="totem-product-page-summary">
          <p class="totem-kicker">{summary.eyebrow}</p>
          <strong>{summary.title}</strong>
          {summary.description ? <p>{summary.description}</p> : null}
          {summary.facts?.length ? (
            <dl class="totem-product-page-summary__facts">
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
