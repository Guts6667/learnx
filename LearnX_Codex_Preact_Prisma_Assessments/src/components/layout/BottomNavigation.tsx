const navigationItems = [
  { href: '/today', label: 'Aujourd’hui' },
  { href: '/program', label: 'Programmes' },
  { href: '/reviews', label: 'Révisions' },
  { href: '/notes', label: 'Notes' },
  { href: '/profile', label: 'Profil' },
] as const;

export function BottomNavigation() {
  return (
    <nav
      class="fixed right-0 bottom-0 left-0 border-t border-slate-800 bg-slate-950/95 px-2 pt-2 backdrop-blur"
      aria-label="Navigation principale"
    >
      <ul class="mx-auto flex max-w-xl items-stretch justify-between">
        {navigationItems.map(({ href, label }) => (
          <li key={href} class="flex-1">
            <a
              class="flex min-h-11 w-full items-center justify-center rounded-xl px-2 py-3 text-center text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
              href={href}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
      <div class="h-[env(safe-area-inset-bottom)]" aria-hidden="true" />
    </nav>
  );
}
