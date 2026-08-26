import type { ReactNode } from 'react';

import { TotemPublicShell } from '@/components/layout/TotemShell';
import { useI18n } from '@/i18n';

interface PublicPageShellProps {
  children: ReactNode;
  className?: string;
}

/** Minimal public chrome for transactional pages without private navigation. */
export function PublicPageShell({ children, className }: PublicPageShellProps) {
  const { t } = useI18n();

  return (
    <TotemPublicShell
      className={className}
      navigation={
        <div className="landing-header landing-header--minimal">
          <a className="landing-brand" href="/">
            <img alt="" aria-hidden="true" src="/learnx-mark-on-paper.svg" />
            <span>{t('app.name')}</span>
          </a>
        </div>
      }
      skipLinkLabel={t('navigation.skipToContent')}
    >
      {children}
    </TotemPublicShell>
  );
}
