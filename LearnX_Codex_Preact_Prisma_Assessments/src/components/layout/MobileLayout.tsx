import type { ComponentChildren } from 'preact';

import { BottomNavigation } from '@/components/layout/BottomNavigation';

interface MobileLayoutProps {
  children: ComponentChildren;
}

export function MobileLayout({ children }: MobileLayoutProps) {
  return (
    <div class="min-h-dvh bg-slate-950 text-slate-100">
      <header class="border-b border-slate-800 bg-slate-950 px-5 py-4">
        <div class="mx-auto flex max-w-xl items-center justify-between">
          <a class="text-lg font-bold tracking-tight text-white" href="/today">
            LearnX
          </a>
          <span class="text-sm text-slate-400">Parcours personnel</span>
        </div>
      </header>
      <main
        id="main-content"
        class="mx-auto max-w-xl px-5 py-8 pb-28"
        tabindex={-1}
      >
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
}
