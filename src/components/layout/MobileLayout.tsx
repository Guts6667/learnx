import type { ReactNode } from 'react';
import { navigate as route } from '@/app/navigation';
import { useCallback, useState } from 'react';

import {
  BackNavigationProvider,
  type BackNavigationTarget,
} from '@/components/layout/BackNavigationContext';
import { AdminNavigation } from '@/components/layout/AdminNavigation';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { TotemAppShell } from '@/components/layout/TotemShell';
import { useSessionQuery } from '@/features/auth/session';
import { PwaProvider, PwaStatus } from '@/features/pwa/PwaStatus';
import { useI18n } from '@/i18n';
import { TotemTheme } from '@/components/ui/TotemTheme';

interface MobileLayoutProps {
  canGoBack?: boolean;
  children: ReactNode;
  currentPath?: string;
}

const rootPaths = new Set([
  '/',
  '/login',
  '/request-access',
  '/verify-email',
  '/today',
  '/program',
  '/discover',
  '/reviews',
  '/notes',
  '/profile',
  '/admin',
]);

const authenticationPaths = new Set([
  '/login',
  '/request-access',
  '/verify-email',
  '/activate',
]);

function usesTotemProductSurface(currentPath: string): boolean {
  if (
    currentPath === '/today' ||
    currentPath === '/program' ||
    currentPath === '/discover' ||
    currentPath === '/reviews' ||
    currentPath === '/credits' ||
    currentPath === '/profile' ||
    currentPath.startsWith('/notes')
  ) {
    return true;
  }

  return currentPath.startsWith('/program/');
}

function SessionNavigation({ currentPath }: { currentPath: string }) {
  const sessionQuery = useSessionQuery();

  if (!sessionQuery.data?.user) return null;

  return <BottomNavigation currentPath={currentPath} />;
}

function PrivateNavigation({ currentPath }: { currentPath: string }) {
  if (authenticationPaths.has(currentPath)) return null;

  return <SessionNavigation currentPath={currentPath} />;
}

export function MobileLayout({
  canGoBack = false,
  children,
  currentPath = window.location.pathname,
}: MobileLayoutProps) {
  const { t } = useI18n();
  const [backTarget, setBackTarget] = useState<BackNavigationTarget | null>(
    null,
  );
  const updateBackTarget = useCallback(
    (target: BackNavigationTarget | null) => {
      setBackTarget(target);
    },
    [],
  );

  function focusMainContent() {
    window.requestAnimationFrame(() => {
      document.getElementById('main-content')?.focus();
    });
  }

  function goBack() {
    if (backTarget) {
      route(backTarget.href);
      return;
    }

    if (canGoBack) {
      window.history.back();
      return;
    }

    route('/today');
  }

  const isStandalonePublicPage =
    currentPath === '/' ||
    currentPath === '/interest' ||
    (import.meta.env.DEV &&
      (currentPath === '/design/totem-primitives' ||
        currentPath === '/design/totem-admin' ||
        currentPath === '/design/totem-product'));

  if (isStandalonePublicPage) {
    return <PwaProvider>{children}</PwaProvider>;
  }

  if (currentPath.startsWith('/admin')) {
    return (
      <PwaProvider>
        <a
          className="ui-action ui-action--primary fixed top-2 left-2 z-50 -translate-y-20 px-4 py-3 transition focus:translate-y-0"
          href="#main-content"
          onClick={focusMainContent}
        >
          {t('navigation.skipToContent')}
        </a>
        <BackNavigationProvider onTargetChange={updateBackTarget}>
          <TotemAppShell
            bottomNavigation={<AdminNavigation currentPath={currentPath} />}
            className="totem-admin-surface"
            contentId="main-content"
            contentTabIndex={-1}
            sidebar={<AdminNavigation currentPath={currentPath} />}
            topbar={
              <div className="totem-admin-topbar">
                <div className="totem-admin-topbar__context">
                  {!rootPaths.has(currentPath) ? (
                    <button
                      aria-label={
                        backTarget
                          ? t(backTarget.labelKey)
                          : t('navigation.back.ariaLabel')
                      }
                      className="ui-action ui-action--secondary min-h-11 px-3"
                      onClick={goBack}
                      type="button"
                    >
                      <span aria-hidden="true">←</span>
                      <span className="ml-2 hidden sm:inline">
                        {backTarget
                          ? t(backTarget.labelKey)
                          : t('navigation.back.label')}
                      </span>
                    </button>
                  ) : null}
                  <div>
                    <p className="page-eyebrow">{t('admin.eyebrow')}</p>
                    <p className="totem-admin-topbar__title">
                      {t('admin.title')}
                    </p>
                  </div>
                </div>
                <a
                  aria-label={t('admin.navigation.backToApp')}
                  className="ui-action ui-action--secondary min-h-11 min-w-11 px-3 lg:hidden"
                  href="/today"
                >
                  <span aria-hidden="true">↗</span>
                  <span className="sr-only">
                    {t('admin.navigation.backToApp')}
                  </span>
                </a>
              </div>
            }
          >
            <PwaStatus />
            {children}
          </TotemAppShell>
        </BackNavigationProvider>
      </PwaProvider>
    );
  }

  if (authenticationPaths.has(currentPath)) {
    return (
      <PwaProvider>
        <TotemTheme className="totem-auth-surface">
          <a
            className="ui-action ui-action--primary fixed top-2 left-2 z-50 -translate-y-20 px-4 py-3 transition focus:translate-y-0"
            href="#main-content"
            onClick={focusMainContent}
          >
            {t('navigation.skipToContent')}
          </a>
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
      </PwaProvider>
    );
  }

  const privateLayout = (
    <div className="app-layout min-h-dvh bg-[var(--color-canvas)] text-[var(--color-text)]">
      <a
        className="ui-action ui-action--primary fixed top-2 left-2 z-50 -translate-y-20 px-4 py-3 transition focus:translate-y-0"
        href="#main-content"
        onClick={focusMainContent}
      >
        {t('navigation.skipToContent')}
      </a>
      <header
        className={`app-safe-header border-b border-[var(--color-border)] bg-[var(--color-canvas)] ${rootPaths.has(currentPath) ? 'app-safe-header--root' : ''} ${currentPath === '/discover' ? 'app-safe-header--discover' : ''}`}
      >
        <div className="app-frame app-safe-header__content mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {currentPath === '/discover' ? (
              <button
                aria-label={t('navigation.back.programs')}
                className="ui-action ui-action--secondary min-h-11 min-w-11 px-3"
                onClick={() => route('/program')}
                type="button"
              >
                <span aria-hidden="true">←</span>
              </button>
            ) : null}
            {!rootPaths.has(currentPath) ? (
              <button
                aria-label={
                  backTarget
                    ? t(backTarget.labelKey)
                    : t('navigation.back.ariaLabel')
                }
                className="ui-action ui-action--secondary min-h-11 min-w-11 px-3"
                onClick={goBack}
                type="button"
              >
                <span aria-hidden="true">←</span>
                <span className="ml-2 hidden sm:inline">
                  {backTarget
                    ? t(backTarget.labelKey)
                    : t('navigation.back.label')}
                </span>
              </button>
            ) : null}
            {currentPath !== '/discover' ? (
              <a
                className="inline-flex min-h-11 items-center rounded-lg text-lg font-medium tracking-tight text-[var(--color-text)]"
                href={authenticationPaths.has(currentPath) ? '/' : '/today'}
              >
                {t('app.name')}
              </a>
            ) : null}
          </div>
          {currentPath === '/discover' ? (
            <strong className="app-safe-header__mobile-title">
              {t('programs.explore')}
            </strong>
          ) : (
            <span className="ui-text-muted hidden text-sm sm:inline">
              {t('app.tagline')}
            </span>
          )}
          {currentPath === '/discover' ? (
            <span aria-hidden="true" className="size-11" />
          ) : null}
        </div>
      </header>
      <PwaStatus showInstallPrompt={currentPath !== '/profile'} />
      <BackNavigationProvider onTargetChange={updateBackTarget}>
        <main
          id="main-content"
          className="app-safe-main app-frame mx-auto py-8 lg:py-10"
          tabIndex={-1}
        >
          {children}
        </main>
      </BackNavigationProvider>
      <PrivateNavigation currentPath={currentPath} />
    </div>
  );

  return (
    <PwaProvider>
      {usesTotemProductSurface(currentPath) ? (
        <TotemTheme className="totem-product-surface">
          {privateLayout}
        </TotemTheme>
      ) : (
        privateLayout
      )}
    </PwaProvider>
  );
}
