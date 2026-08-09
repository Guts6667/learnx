import {
  NavigationIcon,
  type NavigationIconName,
} from '@/components/layout/NavigationIcon';
import type { MessageKey } from '@/i18n/catalogs';
import { useI18n } from '@/i18n';

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

  return (
    <nav
      aria-label={t('navigation.main.ariaLabel')}
      class="app-main-navigation app-safe-navigation fixed right-0 bottom-0 left-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur lg:top-0 lg:right-auto lg:w-[var(--app-navigation-width)] lg:border-t-0 lg:border-r"
    >
      <ul class="mx-auto grid max-w-xl grid-cols-5 items-stretch gap-1 lg:flex lg:h-full lg:max-w-none lg:flex-col lg:justify-center lg:gap-2">
        {navigationItems.map(({ href, icon, labelKey }) => {
          const current = isCurrentPage(currentPath, href);
          const label = t(labelKey);

          return (
            <li class="min-w-0 lg:w-full" key={href}>
              <a
                aria-current={current ? 'page' : undefined}
                class={`flex min-h-16 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-2 text-center text-[0.8125rem] leading-tight font-semibold transition hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 lg:min-h-16 lg:px-2 ${current ? 'bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-400/60 ring-inset' : 'text-slate-300'}`}
                href={href}
              >
                <NavigationIcon name={icon} />
                <span class="max-w-full break-words text-center">{label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
