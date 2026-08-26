import { classNames } from '@/components/ui/classNames';

interface PageHeaderProps {
  className?: string;
  description?: string;
  eyebrow: string;
  id: string;
  title: string;
}

export function PageHeader({
  className,
  description,
  eyebrow,
  id,
  title,
}: PageHeaderProps) {
  return (
    <header className={classNames('page-header', className)}>
      <p className="page-eyebrow">{eyebrow}</p>
      <h1 className="page-title" id={id}>
        {title}
      </h1>
      {description ? <p className="page-description">{description}</p> : null}
    </header>
  );
}
