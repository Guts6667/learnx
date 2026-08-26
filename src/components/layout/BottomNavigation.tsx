import {
  NavigationIcon,
  type NavigationIconName,
} from '@/components/layout/NavigationIcon';
import type { MessageKey } from '@/i18n/catalogs';
import { useI18n } from '@/i18n';
import { useSessionQuery } from '@/features/auth/session';
import { useEffect, useState } from 'preact/hooks';

const navigationItems = [
  { href: '/today', icon: 'home', labelKey: 'navigation.home' },
  { href: '/program', icon: 'journey', labelKey: 'navigation.programs' },
  { href: '/reviews', icon: 'review', labelKey: 'navigation.reviews' },
  { href: '/notes', icon: 'notes', labelKey: 'navigation.notes' },
  { href: '/profile', icon: 'profile', labelKey: 'navigation.profile' },
] as const satisfies ReadonlyArray<{
  href: string;
  icon: NavigationIconName;
  labelKey: MessageKey;
}>;

function isCurrentPage(currentPath: string, href: string): boolean {
  if (href === '/program') return currentPath.startsWith('/program');
  if (href === '/notes') return currentPath.startsWith('/notes');

  return currentPath === href;
}

export function BottomNavigation({ currentPath = window.location.pathname }) {
  const { t } = useI18n();
  const sessionQuery = useSessionQuery();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const displayName =
    sessionQuery.data?.user?.displayName ?? t('navigation.profile');
  const profileInitial = displayName.trim().slice(0, 1).toLocaleUpperCase();

  useEffect(() => {
    document.documentElement.dataset.sidebarCollapsed = String(isCollapsed);

    return () => {
      delete document.documentElement.dataset.sidebarCollapsed;
    };
  }, [isCollapsed]);

  return (
    <nav
      aria-label={t('navigation.main.ariaLabel')}
      class="app-main-navigation ui-main-navigation app-safe-navigation fixed right-0 bottom-0 left-0 z-40 border-t backdrop-blur lg:top-0 lg:right-auto lg:w-[var(--app-navigation-width)] lg:border-t-0 lg:border-r"
    >
      <div class="app-main-navigation__brand">
        <span aria-hidden="true" class="app-main-navigation__mark">
          LX
        </span>
        <span class="app-main-navigation__brand-label">{t('app.name')}</span>
        <button
          aria-label={t(
            isCollapsed
              ? 'navigation.expandSidebar'
              : 'navigation.collapseSidebar',
          )}
          aria-pressed={isCollapsed}
          class="app-main-navigation__collapse"
          onClick={() => setIsCollapsed((current) => !current)}
          title={t(
            isCollapsed
              ? 'navigation.expandSidebar'
              : 'navigation.collapseSidebar',
          )}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              d={isCollapsed ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'}
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.8"
            />
          </svg>
        </button>
      </div>
      <ul class="mx-auto grid max-w-xl grid-cols-5 items-stretch gap-1 lg:flex lg:min-h-0 lg:max-w-none lg:flex-1 lg:flex-col lg:gap-2">
        {navigationItems.map(({ href, icon, labelKey }) => {
          const current = isCurrentPage(currentPath, href);
          const label = t(labelKey);

          return (
            <li
              class={`min-w-0 lg:w-full ${href === '/profile' ? 'lg:mt-auto' : ''}`}
              key={href}
            >
              <a
                aria-label={label}
                aria-current={current ? 'page' : undefined}
                class={`ui-main-navigation__link flex min-h-16 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-2 text-center text-[0.8125rem] leading-tight font-medium lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-left ${href === '/profile' ? 'ui-main-navigation__link--profile' : ''}`}
                href={href}
              >
                {href === '/profile' ? (
                  <>
                    <span class="app-main-navigation__profile-mobile-icon">
                      <NavigationIcon name={icon} />
                    </span>
                    <span
                      aria-hidden="true"
                      class="app-main-navigation__profile-initial"
                    >
                      {profileInitial}
                    </span>
                  </>
                ) : (
                  <NavigationIcon name={icon} />
                )}
                <span class="ui-main-navigation__label max-w-full break-words text-center lg:text-left">
                  {href === '/profile' ? (
                    <>
                      <span class="app-main-navigation__profile-name">
                        {displayName}
                      </span>
                      <span class="app-main-navigation__profile-label">
                        {label}
                      </span>
                    </>
                  ) : (
                    label
                  )}
                </span>
                {href === '/profile' ? (
                  <span
                    aria-hidden="true"
                    class="app-main-navigation__profile-arrow"
                  >
                    ›
                  </span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
