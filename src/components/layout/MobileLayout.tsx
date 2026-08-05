import type { ComponentChildren } from 'preact';
import { route } from 'preact-router';
import { useCallback, useState } from 'preact/hooks';

import { BackNavigationProvider } from '@/components/layout/BackNavigationContext';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { PwaStatus } from '@/features/pwa/PwaStatus';

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
  '/today',
]);

export function MobileLayout({
  canGoBack = false,
  children,
  currentPath = window.location.pathname,
}: MobileLayoutProps) {
  const [backTarget, setBackTarget] = useState<string | null>(null);
  const updateBackTarget = useCallback((href: string | null) => {
    setBackTarget(href);
  }, []);

  function focusMainContent() {
    window.requestAnimationFrame(() => {
      document.getElementById('main-content')?.focus();
    });
  }

  function goBack() {
    if (backTarget) {
      route(backTarget);
      return;
    }

    if (canGoBack) {
      window.history.back();
      return;
    }

    route('/today');
  }

  return (
    <div class="app-layout min-h-dvh bg-slate-950 text-slate-100">
      <a
        class="fixed top-2 left-2 z-50 -translate-y-20 rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition focus:translate-y-0 focus:outline-2 focus:outline-offset-2 focus:outline-white"
        href="#main-content"
        onClick={focusMainContent}
      >
        Aller au contenu principal
      </a>
      <header class="app-safe-header border-b border-slate-800 bg-slate-950">
        <div class="app-frame mx-auto flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            {!rootPaths.has(currentPath) ? (
              <button
                aria-label="Revenir à la page précédente"
                class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-slate-800 px-3 font-semibold text-slate-100 transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                onClick={goBack}
                type="button"
              >
                <span aria-hidden="true">←</span>
                <span class="ml-2 hidden sm:inline">Retour</span>
              </button>
            ) : null}
            <a
              class="inline-flex min-h-11 items-center rounded-lg text-lg font-bold tracking-tight text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
              href="/today"
            >
              LearnX
            </a>
          </div>
          <span class="text-sm text-slate-400">Parcours personnel</span>
        </div>
      </header>
      <PwaStatus />
      <BackNavigationProvider onTargetChange={updateBackTarget}>
        <main
          id="main-content"
          class="app-safe-main app-frame mx-auto py-8 lg:py-10"
          tabindex={-1}
        >
          {children}
        </main>
      </BackNavigationProvider>
      <BottomNavigation currentPath={currentPath} />
    </div>
  );
}
