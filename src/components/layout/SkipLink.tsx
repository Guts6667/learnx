import type { MouseEvent } from 'react';

import { classNames } from '@/components/ui/classNames';

interface SkipLinkProps {
  className?: string;
  label: string;
  targetId?: string;
}

export function SkipLink({
  className,
  label,
  targetId = 'main-content',
}: SkipLinkProps) {
  function focusTarget(event: MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById(targetId);
    if (!target) return;

    event.preventDefault();
    target.focus({ preventScroll: true });
  }

  return (
    <a
      className={classNames('app-skip-link', className)}
      href={`#${targetId}`}
      onClick={focusTarget}
    >
      {label}
    </a>
  );
}
