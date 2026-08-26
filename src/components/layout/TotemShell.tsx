import type { HTMLAttributes, ReactNode } from 'react';

import { classNames } from '@/components/ui/classNames';
import { SkipLink } from '@/components/layout/SkipLink';
import { TotemTheme } from '@/components/ui/TotemTheme';

interface TotemAppShellProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'className'
> {
  bottomNavigation?: ReactNode;
  children: ReactNode;
  className?: string;
  contentId?: string;
  contentTabIndex?: number;
  pageHeader?: ReactNode;
  rail?: ReactNode;
  sidebar?: ReactNode;
  topbar: ReactNode;
}

/** Layout-only shell. Consumers own navigation labels, routes and permissions. */
export function TotemAppShell({
  bottomNavigation,
  children,
  className,
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
      className={classNames(
        'totem-app-shell',
        !rail && 'totem-app-shell--without-rail',
        !sidebar && 'totem-app-shell--without-sidebar',
        className,
      )}
      {...props}
    >
      {sidebar ? (
        <aside className="totem-app-shell__sidebar">{sidebar}</aside>
      ) : null}
      <header className="totem-app-shell__topbar">{topbar}</header>
      <main className="totem-app-shell__main">
        {pageHeader ? (
          <div className="totem-app-shell__page-head">{pageHeader}</div>
        ) : null}
        <div
          className={classNames(
            'totem-app-shell__content',
            Boolean(pageHeader) && 'totem-app-shell__content--after-page-head',
          )}
          id={contentId}
          tabIndex={contentTabIndex}
        >
          {children}
        </div>
      </main>
      {rail ? <aside className="totem-app-shell__rail">{rail}</aside> : null}
      {bottomNavigation ? (
        <div className="totem-app-shell__bottom-navigation">
          {bottomNavigation}
        </div>
      ) : null}
    </TotemTheme>
  );
}

interface TotemPublicShellProps {
  children: ReactNode;
  className?: string;
  contentId?: string;
  footer?: ReactNode;
  navigation: ReactNode;
  skipLinkLabel?: string;
}

export function TotemPublicShell({
  children,
  className,
  contentId = 'main-content',
  footer,
  navigation,
  skipLinkLabel,
}: TotemPublicShellProps) {
  return (
    <TotemTheme className={classNames('totem-public-shell', className)}>
      {skipLinkLabel ? (
        <SkipLink label={skipLinkLabel} targetId={contentId} />
      ) : null}
      <header className="totem-public-shell__navigation">{navigation}</header>
      <main id={contentId} tabIndex={-1}>
        {children}
      </main>
      {footer ? (
        <footer className="totem-public-shell__footer">{footer}</footer>
      ) : null}
    </TotemTheme>
  );
}
