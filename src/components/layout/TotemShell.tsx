import type { ComponentChildren, JSX } from 'preact';

import { classNames } from '@/components/ui/classNames';
import { TotemTheme } from '@/components/ui/TotemTheme';

interface TotemAppShellProps extends Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  'class'
> {
  bottomNavigation?: ComponentChildren;
  children: ComponentChildren;
  class?: string;
  contentId?: string;
  contentTabIndex?: number;
  pageHeader?: ComponentChildren;
  rail?: ComponentChildren;
  sidebar?: ComponentChildren;
  topbar: ComponentChildren;
}

/** Layout-only shell. Consumers own navigation labels, routes and permissions. */
export function TotemAppShell({
  bottomNavigation,
  children,
  class: className,
  contentId,
  contentTabIndex,
  pageHeader,
  rail,
  sidebar,
  topbar,
  ...props
}: TotemAppShellProps) {
  return (
    <TotemTheme
      class={classNames(
        'totem-app-shell',
        !rail && 'totem-app-shell--without-rail',
        !sidebar && 'totem-app-shell--without-sidebar',
        className,
      )}
      {...props}
    >
      {sidebar ? <aside class="totem-app-shell__sidebar">{sidebar}</aside> : null}
      <header class="totem-app-shell__topbar">{topbar}</header>
      <main class="totem-app-shell__main">
        {pageHeader ? (
          <div class="totem-app-shell__page-head">{pageHeader}</div>
        ) : null}
        <div
          class={classNames(
            'totem-app-shell__content',
            Boolean(pageHeader) &&
              'totem-app-shell__content--after-page-head',
          )}
          id={contentId}
          tabindex={contentTabIndex}
        >
          {children}
        </div>
      </main>
      {rail ? <aside class="totem-app-shell__rail">{rail}</aside> : null}
      {bottomNavigation ? (
        <div class="totem-app-shell__bottom-navigation">{bottomNavigation}</div>
      ) : null}
    </TotemTheme>
  );
}

interface TotemPublicShellProps {
  children: ComponentChildren;
  footer: ComponentChildren;
  navigation: ComponentChildren;
}

export function TotemPublicShell({
  children,
  footer,
  navigation,
}: TotemPublicShellProps) {
  return (
    <TotemTheme class="totem-public-shell">
      <header class="totem-public-shell__navigation">{navigation}</header>
      <main>{children}</main>
      <footer class="totem-public-shell__footer">{footer}</footer>
    </TotemTheme>
  );
}
