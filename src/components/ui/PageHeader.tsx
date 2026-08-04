import { classNames } from '@/components/ui/classNames';

interface PageHeaderProps {
  class?: string;
  description?: string;
  eyebrow: string;
  id: string;
  title: string;
}

export function PageHeader({
  class: className,
  description,
  eyebrow,
  id,
  title,
}: PageHeaderProps) {
  return (
    <header class={classNames('page-header', className)}>
      <p class="page-eyebrow">{eyebrow}</p>
      <h1 class="page-title" id={id}>
        {title}
      </h1>
      {description ? <p class="page-description">{description}</p> : null}
    </header>
  );
}
