import type { MessageKey } from '@/i18n/catalogs';
import { useI18n } from '@/i18n';

const adminNavigationItems = [
  {
    href: '/admin',
    labelKey: 'admin.programs',
    shortLabelKey: 'admin.navigation.programs',
  },
  {
    href: '/admin/access-requests',
    labelKey: 'admin.requests.title',
    shortLabelKey: 'admin.navigation.requests',
  },
  {
    href: '/admin/accounts',
    labelKey: 'admin.accounts.title',
    shortLabelKey: 'admin.navigation.accounts',
  },
  {
    href: '/admin/contacts',
    labelKey: 'admin.contacts.title',
    shortLabelKey: 'admin.navigation.contacts',
  },
  {
    href: '/admin/credits',
    labelKey: 'admin.credits.title',
    shortLabelKey: 'admin.navigation.credits',
  },
] as const satisfies ReadonlyArray<{
  href: string;
  labelKey: MessageKey;
  shortLabelKey: MessageKey;
}>;

function isCurrentAdminPage(currentPath: string, href: string): boolean {
  if (href === '/admin') {
    return currentPath === '/admin' || currentPath.startsWith('/admin/program/');
  }

  return currentPath === href;
}

export function AdminNavigation({
  currentPath = window.location.pathname,
}: {
  currentPath?: string;
}) {
  const { t } = useI18n();

  return (
    <nav
      aria-label={t('admin.navigation.label')}
      class="totem-admin-navigation"
    >
      <div class="totem-admin-navigation__brand" aria-hidden="true">
        <span class="totem-admin-navigation__mark">LX</span>
        <span>LearnX</span>
      </div>
      <ul class="totem-admin-navigation__list">
        {adminNavigationItems.map(({ href, labelKey, shortLabelKey }) => {
          const current = isCurrentAdminPage(currentPath, href);
          return (
            <li key={href}>
              <a
                aria-current={current ? 'page' : undefined}
                aria-label={t(shortLabelKey)}
                class="totem-admin-navigation__link"
                href={href}
              >
                <span class="totem-admin-navigation__index" aria-hidden="true" />
                <span class="totem-admin-navigation__label--long">
                  {t(labelKey)}
                </span>
                <span class="totem-admin-navigation__label--short">
                  {t(shortLabelKey)}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
