import { useCallback, useState, type ReactNode } from 'react';

import { navigate as route } from '@/app/navigation';
import {
  AdminAppShell,
  AuthenticatedAppShell,
  AuthenticationShell,
} from '@/components/layout/AppShells';
import {
  BackNavigationProvider,
  type BackNavigationTarget,
} from '@/components/layout/BackNavigationContext';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { TotemTheme } from '@/components/ui/TotemTheme';
import { useSessionQuery } from '@/features/auth/session';
import { PwaProvider } from '@/features/pwa/PwaStatus';

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
  return (
    currentPath === '/today' ||
    currentPath === '/program' ||
    currentPath === '/discover' ||
    currentPath === '/reviews' ||
    currentPath === '/credits' ||
    currentPath === '/profile' ||
    currentPath.startsWith('/notes') ||
    currentPath.startsWith('/program/')
  );
}

function SessionNavigation({ currentPath }: { currentPath: string }) {
  const sessionQuery = useSessionQuery();
  if (!sessionQuery.data?.user) return null;

  return <BottomNavigation currentPath={currentPath} />;
}

function StandaloneRoute({ children }: { children: ReactNode }) {
  return <PwaProvider>{children}</PwaProvider>;
}

export function MobileLayout({
  canGoBack = false,
  children,
  currentPath = window.location.pathname,
}: MobileLayoutProps) {
  const [backTarget, setBackTarget] = useState<BackNavigationTarget | null>(
    null,
  );
  const updateBackTarget = useCallback(
    (target: BackNavigationTarget | null) => setBackTarget(target),
    [],
  );

  function goBack() {
    if (currentPath === '/discover') {
      route('/program');
      return;
    }
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

  const isDevelopmentPreview =
    import.meta.env.DEV && currentPath.startsWith('/design/totem-');
  if (
    currentPath === '/' ||
    currentPath === '/interest' ||
    isDevelopmentPreview
  ) {
    return <StandaloneRoute>{children}</StandaloneRoute>;
  }

  const content = (
    <BackNavigationProvider onTargetChange={updateBackTarget}>
      {children}
    </BackNavigationProvider>
  );

  if (currentPath.startsWith('/admin')) {
    return (
      <PwaProvider>
        <AdminAppShell
          backTarget={backTarget}
          currentPath={currentPath}
          onBack={goBack}
          showBackAction={!rootPaths.has(currentPath)}
        >
          {content}
        </AdminAppShell>
      </PwaProvider>
    );
  }

  if (authenticationPaths.has(currentPath)) {
    return (
      <PwaProvider>
        <AuthenticationShell>{children}</AuthenticationShell>
      </PwaProvider>
    );
  }

  const authenticatedShell = (
    <AuthenticatedAppShell
      backTarget={backTarget}
      currentPath={currentPath}
      isDiscoverPage={currentPath === '/discover'}
      navigation={<SessionNavigation currentPath={currentPath} />}
      onBack={goBack}
      showBackAction={!rootPaths.has(currentPath)}
    >
      {content}
    </AuthenticatedAppShell>
  );

  return (
    <PwaProvider>
      {usesTotemProductSurface(currentPath) ? (
        <TotemTheme className="totem-product-surface">
          {authenticatedShell}
        </TotemTheme>
      ) : (
        authenticatedShell
      )}
    </PwaProvider>
  );
}
