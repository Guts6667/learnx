import type { ReactNode } from 'react';

import type { BackNavigationTarget } from '@/components/layout/BackNavigationContext';
import { AdminNavigation } from '@/components/layout/AdminNavigation';
import { SkipLink } from '@/components/layout/SkipLink';
import { TotemAppShell } from '@/components/layout/TotemShell';
import { Button } from '@/components/ui/Button';
import { TotemTheme } from '@/components/ui/TotemTheme';
import { PwaStatus } from '@/features/pwa/PwaStatus';
import { useI18n } from '@/i18n';
import type { MessageKey } from '@/i18n/catalogs';

interface ShellBackActionProps {
  backTarget: BackNavigationTarget | null;
  fallbackLabelKey?: MessageKey;
  onBack: () => void;
}

function ShellBackAction({
  backTarget,
  fallbackLabelKey = 'navigation.back.ariaLabel',
  onBack,
}: ShellBackActionProps) {
  const { t } = useI18n();
  const label = backTarget ? t(backTarget.labelKey) : t(fallbackLabelKey);

  return (
    <Button
      aria-label={label}
      className="min-h-11 min-w-11 px-3"
      onClick={onBack}
      variant="secondary"
    >
      <span aria-hidden="true">←</span>
      <span className="shell-back-action__label">{label}</span>
    </Button>
  );
}

interface AdminAppShellProps extends ShellBackActionProps {
  children: ReactNode;
  currentPath: string;
  showBackAction: boolean;
}

export function AdminAppShell({
  backTarget,
  children,
  currentPath,
  onBack,
  showBackAction,
}: AdminAppShellProps) {
  const { t } = useI18n();

  return (
    <>
      <SkipLink label={t('navigation.skipToContent')} />
      <TotemAppShell
        className="totem-admin-surface"
        contentId="main-content"
        contentTabIndex={-1}
        sidebar={<AdminNavigation currentPath={currentPath} />}
        topbar={
          <div className="totem-admin-topbar">
            <div className="totem-admin-topbar__context">
              {showBackAction ? (
                <ShellBackAction backTarget={backTarget} onBack={onBack} />
              ) : null}
              <div>
                <p className="page-eyebrow">{t('admin.eyebrow')}</p>
                <p className="totem-admin-topbar__title">{t('admin.title')}</p>
              </div>
            </div>
            <a
              aria-label={t('admin.navigation.backToApp')}
              className="ui-action ui-action--secondary min-h-11 min-w-11 px-3 lg:hidden"
              href="/today"
            >
              <span aria-hidden="true">↗</span>
              <span className="sr-only">{t('admin.navigation.backToApp')}</span>
            </a>
          </div>
        }
      >
        <PwaStatus />
        {children}
      </TotemAppShell>
    </>
  );
}

interface AuthenticationShellProps {
  children: ReactNode;
}

export function AuthenticationShell({ children }: AuthenticationShellProps) {
  const { t } = useI18n();

  return (
    <TotemTheme className="totem-auth-surface">
      <SkipLink label={t('navigation.skipToContent')} />
      <div className="totem-auth-layout">
        <aside className="totem-auth-brand">
          <a className="totem-auth-brand__lockup" href="/">
            <span aria-hidden="true" className="totem-auth-brand__mark">
              LX
            </span>
            <span>{t('app.name')}</span>
          </a>
          <div className="totem-auth-brand__copy">
            <p className="page-eyebrow">{t('auth.shell.eyebrow')}</p>
            <h2>{t('auth.shell.title')}</h2>
            <p>{t('auth.shell.description')}</p>
          </div>
        </aside>
        <main className="totem-auth-main" id="main-content" tabIndex={-1}>
          <PwaStatus />
          <div className="totem-auth-content">{children}</div>
        </main>
      </div>
    </TotemTheme>
  );
}

interface AuthenticatedAppShellProps extends ShellBackActionProps {
  children: ReactNode;
  currentPath: string;
  isDiscoverPage: boolean;
  navigation?: ReactNode;
  showBackAction: boolean;
}

export function AuthenticatedAppShell({
  backTarget,
  children,
  currentPath,
  isDiscoverPage,
  navigation,
  onBack,
  showBackAction,
}: AuthenticatedAppShellProps) {
  const { t } = useI18n();

  return (
    <div className="app-layout min-h-dvh bg-[var(--color-canvas)] text-[var(--color-text)]">
      <SkipLink label={t('navigation.skipToContent')} />
      <header
        className={`app-safe-header border-b border-[var(--color-border)] bg-[var(--color-canvas)] ${showBackAction ? '' : 'app-safe-header--root'} ${isDiscoverPage ? 'app-safe-header--discover' : ''}`}
      >
        <div className="app-frame app-safe-header__content mx-auto flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {isDiscoverPage || showBackAction ? (
              <ShellBackAction
                backTarget={backTarget}
                fallbackLabelKey={
                  isDiscoverPage
                    ? 'navigation.back.programs'
                    : 'navigation.back.ariaLabel'
                }
                onBack={onBack}
              />
            ) : null}
            {!isDiscoverPage ? (
              <a className="app-safe-header__brand" href="/today">
                {t('app.name')}
              </a>
            ) : null}
          </div>
          {isDiscoverPage ? (
            <strong className="app-safe-header__mobile-title">
              {t('programs.explore')}
            </strong>
          ) : (
            <span className="app-safe-header__tagline ui-text-muted">
              {t('app.tagline')}
            </span>
          )}
          {isDiscoverPage ? (
            <span aria-hidden="true" className="size-11" />
          ) : null}
        </div>
      </header>
      <PwaStatus showInstallPrompt={currentPath !== '/profile'} />
      <main
        className="app-safe-main app-frame mx-auto py-8 lg:py-10"
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </main>
      {navigation}
    </div>
  );
}
