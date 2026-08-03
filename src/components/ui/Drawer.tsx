import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';

import { Button } from '@/components/ui/Button';

interface DrawerProps {
  children: ComponentChildren;
  isOpen: boolean;
  onDismiss: () => void;
  title: string;
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function Drawer({ children, isOpen, onDismiss, title }: DrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current
      ?.querySelector<HTMLElement>('[data-drawer-close]')
      ?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  function handleKeyDown(event: JSX.TargetedKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onDismiss();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <div
      class="fixed inset-0 z-50 flex justify-end bg-slate-950/80"
      onClick={(event) => {
        if (event.currentTarget === event.target) onDismiss();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        class="app-safe-main h-full w-full max-w-md overflow-y-auto border-l border-slate-700 bg-slate-950 px-5 py-6 shadow-2xl"
        ref={panelRef}
        role="dialog"
      >
        <div class="mb-6 flex items-start justify-between gap-4">
          <h2 class="text-xl font-bold" id={titleId}>
            {title}
          </h2>
          <Button
            aria-label="Fermer le panneau"
            data-drawer-close
            onClick={onDismiss}
            size="sm"
            variant="ghost"
          >
            Fermer
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
