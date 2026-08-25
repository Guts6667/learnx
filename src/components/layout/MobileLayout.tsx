import type { ComponentChildren } from 'preact';
import { route } from 'preact-router';
import { useCallback, useState } from 'preact/hooks';

import {
  BackNavigationProvider,
  type BackNavigationTarget,
} from '@/components/layout/BackNavigationContext';
import { AdminNavigation } from '@/components/layout/AdminNavigation';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { LearningAuthorityShell } from '@/components/layout/LearningAuthorityShell';
import { TotemAppShell } from '@/components/layout/TotemShell';
import { useSessionQuery } from '@/features/auth/session';
import { PwaProvider, PwaStatus } from '@/features/pwa/PwaStatus';
import { useI18n } from '@/i18n';
import { TotemTheme } from '@/components/ui/TotemTheme';

interface MobileLayoutProps {
  canGoBack?: boolean;
  children: ComponentChildren;
  currentPath?: string;
}

const rootPaths = new Set([
  '/',
  '/login',
  '/request-access',
  '/verify-email',
  '/first-direction',
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
  '/first-direction',
]);

function authBrandKeys(currentPath: string) {
  if (currentPath === '/activate') {
    return {
      description: 'auth.activate.shellDescription',
      eyebrow: 'auth.activate.shellEyebrow',
      title: 'auth.activate.shellTitle',
    } as const;
  }

  if (currentPath === '/verify-email') {
    return {
      description: 'auth.verify.shellDescription',
      eyebrow: 'auth.verify.shellEyebrow',
      title: 'auth.verify.shellTitle',
    } as const;
  }

  if (currentPath === '/first-direction') {
    return {
      description: 'auth.firstDirection.shellDescription',
      eyebrow: 'auth.firstDirection.shellEyebrow',
      title: 'auth.firstDirection.shellTitle',
    } as const;
  }

  return {
    description: 'auth.shell.description',
    eyebrow: 'auth.shell.eyebrow',
    title: 'auth.shell.title',
  } as const;
}

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

function usesLearningAuthoritySurface(currentPath: string): boolean {
  if (currentPath === '/reviews') return true;

  return /^\/program\/[^/]+\/lesson\/[^/]+(?:\/exercise\/[^/]+)?\/?$/.test(
    currentPath,
  );
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
          class="ui-action ui-action--primary fixed top-2 left-2 z-50 -translate-y-20 px-4 py-3 transition focus:translate-y-0"
          href="#main-content"
          onClick={focusMainContent}
        >
          {t('navigation.skipToContent')}
        </a>
        <BackNavigationProvider onTargetChange={updateBackTarget}>
          <TotemAppShell
            bottomNavigation={<AdminNavigation currentPath={currentPath} />}
            class="totem-admin-surface"
            contentId="main-content"
            contentTabIndex={-1}
            sidebar={<AdminNavigation currentPath={currentPath} />}
            topbar={
              <div class="totem-admin-topbar">
                <div class="totem-admin-topbar__context">
                  {!rootPaths.has(currentPath) ? (
                    <button
                      aria-label={
                        backTarget
                          ? t(backTarget.labelKey)
                          : t('navigation.back.ariaLabel')
                      }
                      class="ui-action ui-action--secondary min-h-11 px-3"
                      onClick={goBack}
                      type="button"
                    >
                      <span aria-hidden="true">←</span>
                      <span class="ml-2 hidden sm:inline">
                        {backTarget
                          ? t(backTarget.labelKey)
                          : t('navigation.back.label')}
                      </span>
                    </button>
                  ) : null}
                  <div>
                    <p class="page-eyebrow">{t('admin.eyebrow')}</p>
                    <p class="totem-admin-topbar__title">{t('admin.title')}</p>
                  </div>
                </div>
                <a
                  aria-label={t('admin.navigation.backToApp')}
                  class="ui-action ui-action--secondary min-h-11 min-w-11 px-3 lg:hidden"
                  href="/today"
                >
                  <span aria-hidden="true">↗</span>
                  <span class="sr-only">{t('admin.navigation.backToApp')}</span>
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
    const authBrand = authBrandKeys(currentPath);
    return (
      <PwaProvider>
        <TotemTheme class="totem-auth-surface">
          <a
            class="ui-action ui-action--primary fixed top-2 left-2 z-50 -translate-y-20 px-4 py-3 transition focus:translate-y-0"
            href="#main-content"
            onClick={focusMainContent}
          >
            {t('navigation.skipToContent')}
          </a>
          <div class="totem-auth-layout">
            <aside class="totem-auth-brand">
              <a class="totem-auth-brand__lockup" href="/">
                <img
                  alt=""
                  aria-hidden="true"
                  class="totem-auth-brand__mark"
                  src="/learnx-mark-on-night.svg"
                />
                <span>{t('app.name')}</span>
              </a>
              <div class="totem-auth-brand__copy">
                <p class="page-eyebrow">{t(authBrand.eyebrow)}</p>
                <h2>{t(authBrand.title)}</h2>
                <p>{t(authBrand.description)}</p>
              </div>
            </aside>
            <main class="totem-auth-main" id="main-content" tabindex={-1}>
              <PwaStatus />
              <div class="totem-auth-content">{children}</div>
            </main>
          </div>
        </TotemTheme>
      </PwaProvider>
    );
  }

  if (usesLearningAuthoritySurface(currentPath)) {
    return (
      <PwaProvider>
        <TotemTheme class="totem-product-surface totem-learning-authority-surface">
          <a
            class="ui-action ui-action--primary fixed top-2 left-2 z-50 -translate-y-20 px-4 py-3 transition focus:translate-y-0"
            href="#main-content"
            onClick={focusMainContent}
          >
            {t('navigation.skipToContent')}
          </a>
          <PwaStatus showInstallPrompt={false} />
          <BackNavigationProvider onTargetChange={updateBackTarget}>
            <LearningAuthorityShell
              backTarget={backTarget}
              currentPath={currentPath}
              onBack={goBack}
            >
              {children}
            </LearningAuthorityShell>
          </BackNavigationProvider>
        </TotemTheme>
      </PwaProvider>
    );
  }

  const privateLayout = (
    <div class="app-layout min-h-dvh bg-[var(--color-canvas)] text-[var(--color-text)]">
      <a
        class="ui-action ui-action--primary fixed top-2 left-2 z-50 -translate-y-20 px-4 py-3 transition focus:translate-y-0"
        href="#main-content"
        onClick={focusMainContent}
      >
        {t('navigation.skipToContent')}
      </a>
      <header
        class={`app-safe-header border-b border-[var(--color-border)] bg-[var(--color-canvas)] ${rootPaths.has(currentPath) ? 'app-safe-header--root' : ''} ${currentPath === '/discover' ? 'app-safe-header--discover' : ''}`}
      >
        <div class="app-frame app-safe-header__content mx-auto flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            {currentPath === '/discover' ? (
              <button
                aria-label={t('navigation.back.programs')}
                class="ui-action ui-action--secondary min-h-11 min-w-11 px-3"
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
                class="ui-action ui-action--secondary min-h-11 min-w-11 px-3"
                onClick={goBack}
                type="button"
              >
                <span aria-hidden="true">←</span>
                <span class="ml-2 hidden sm:inline">
                  {backTarget
                    ? t(backTarget.labelKey)
                    : t('navigation.back.label')}
                </span>
              </button>
            ) : null}
            {currentPath !== '/discover' ? (
              <a
                class="inline-flex min-h-11 items-center rounded-lg text-lg font-medium tracking-tight text-[var(--color-text)]"
                href={authenticationPaths.has(currentPath) ? '/' : '/today'}
              >
                {t('app.name')}
              </a>
            ) : null}
          </div>
          {currentPath === '/discover' ? (
            <strong class="app-safe-header__mobile-title">
              {t('programs.explore')}
            </strong>
          ) : (
            <span class="ui-text-muted hidden text-sm sm:inline">
              {t('app.tagline')}
            </span>
          )}
          {currentPath === '/discover' ? (
            <span aria-hidden="true" class="size-11" />
          ) : null}
        </div>
      </header>
      <PwaStatus showInstallPrompt={currentPath !== '/profile'} />
      <BackNavigationProvider onTargetChange={updateBackTarget}>
        <main
          id="main-content"
          class="app-safe-main app-frame mx-auto py-8 lg:py-10"
          tabindex={-1}
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
        <TotemTheme class="totem-product-surface">{privateLayout}</TotemTheme>
      ) : (
        privateLayout
      )}
    </PwaProvider>
  );
}
