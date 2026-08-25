import type { ComponentChildren } from 'preact';

import type { BackNavigationTarget } from '@/components/layout/BackNavigationContext';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useSessionQuery } from '@/features/auth/session';
import { useI18n } from '@/i18n';

interface LearningAuthorityShellProps {
  backTarget: BackNavigationTarget | null;
  children: ComponentChildren;
  currentPath: string;
  onBack: () => void;
}

function isCurrentPage(currentPath: string, href: string): boolean {
  if (href === '/program') return currentPath.startsWith('/program');
  return currentPath === href;
}

function LearnXMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 512 512">
      <rect fill="#17233b" height="512" width="512" />
      <path d="M132 112h64v224h140v64H132z" fill="#fffaf0" />
      <path
        d="m264 176 44 62 44-62h76l-82 108 88 116h-78l-48-68-48 68h-78l88-116-82-108z"
        fill="#89a7ff"
      />
    </svg>
  );
}

export function LearningAuthorityShell({
  backTarget,
  children,
  currentPath,
  onBack,
}: LearningAuthorityShellProps) {
  const { t } = useI18n();
  const sessionQuery = useSessionQuery();
  const displayName =
    sessionQuery.data?.user?.displayName ?? t('navigation.profile');
  const context =
    currentPath === '/reviews' ? t('reviews.title') : t('learning.lesson');
  const navigation = [
    { href: '/today', label: t('navigation.home') },
    { href: '/program', label: t('navigation.programs') },
    { href: '/reviews', label: t('navigation.reviews') },
    { href: '/notes', label: t('navigation.notes') },
  ];

  return (
    <div class="learning-authority-shell">
      <header class="learning-authority-mobile-header">
        <div class="learning-authority-mobile-header__start">
          {backTarget ? (
            <button
              aria-label={t(backTarget.labelKey)}
              class="learning-authority-back"
              onClick={onBack}
              type="button"
            >
              <span aria-hidden="true">←</span>
            </button>
          ) : null}
          <a class="learning-authority-brand" href="/today">
            <span class="learning-authority-brand__mark">
              <LearnXMark />
            </span>
            <span>{t('app.name')}</span>
          </a>
        </div>
        <span class="learning-authority-mobile-context">{context}</span>
      </header>

      <header class="learning-authority-desktop-header">
        <a class="learning-authority-brand" href="/today">
          <span class="learning-authority-brand__mark">
            <LearnXMark />
          </span>
          <span>{t('app.name')}</span>
        </a>
        <nav aria-label={t('navigation.main.ariaLabel')}>
          {navigation.map(({ href, label }) => (
            <a
              aria-current={
                isCurrentPage(currentPath, href) ? 'page' : undefined
              }
              href={href}
              key={href}
            >
              {label}
            </a>
          ))}
        </nav>
        <a class="learning-authority-profile" href="/profile">
          {displayName} · {t('navigation.profile')}
        </a>
      </header>

      <main class="learning-authority-main" id="main-content" tabIndex={-1}>
        {children}
      </main>
      <div class="learning-authority-bottom-navigation">
        <BottomNavigation currentPath={currentPath} />
      </div>
    </div>
  );
}
