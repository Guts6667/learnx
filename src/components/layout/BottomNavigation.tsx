const navigationItems = [
  { href: '/today', label: 'Aujourd’hui' },
  { href: '/program', label: 'Programmes' },
  { href: '/reviews', label: 'Révisions' },
  { href: '/notes', label: 'Notes' },
  { href: '/profile', label: 'Profil' },
] as const;

function isCurrentPage(currentPath: string, href: string): boolean {
  if (href === '/program') return currentPath.startsWith('/program');
  if (href === '/notes') return currentPath.startsWith('/notes');

  return currentPath === href;
}

export function BottomNavigation({ currentPath = window.location.pathname }) {
  return (
    <nav
      class="app-safe-navigation fixed right-0 bottom-0 left-0 border-t border-slate-800 bg-slate-950/95 pt-2 backdrop-blur"
      aria-label="Navigation principale"
    >
      <ul class="mx-auto flex max-w-xl items-stretch justify-between">
        {navigationItems.map(({ href, label }) => {
          const current = isCurrentPage(currentPath, href);

          return (
            <li key={href} class="flex-1">
              <a
                aria-current={current ? 'page' : undefined}
                class={`flex min-h-11 w-full items-center justify-center rounded-xl px-2 py-3 text-center text-xs font-medium transition hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${current ? 'bg-slate-800 text-white underline decoration-cyan-400 decoration-2 underline-offset-4' : 'text-slate-300'}`}
                href={href}
              >
                {label}
                {current ? <span class="sr-only"> — page actuelle</span> : null}
              </a>
            </li>
          );
        })}
      </ul>
      <div class="h-[env(safe-area-inset-bottom)]" aria-hidden="true" />
    </nav>
  );
}
