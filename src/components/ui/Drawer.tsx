import type { ComponentChildren, JSX } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useId, useRef } from 'preact/hooks';

import { Button } from '@/components/ui/Button';
import { useI18n } from '@/i18n';

interface DrawerProps {
  children: ComponentChildren;
  isOpen: boolean;
  onDismiss: () => void;
  returnFocusElement?: HTMLElement | null;
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

export function Drawer({
  children,
  isOpen,
  onDismiss,
  returnFocusElement,
  title,
}: DrawerProps) {
  const { t } = useI18n();
  const titleId = `drawer-title-${useId()}`;
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const expandedTrigger = document.querySelector<HTMLElement>(
      '[aria-haspopup="dialog"][aria-expanded="true"]',
    );
    returnFocusRef.current =
      returnFocusElement ??
      (activeElement && activeElement !== document.body
        ? activeElement
        : expandedTrigger);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const backgroundElements = Array.from(document.body.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && element !== overlayRef.current,
    );
    const backgroundState = backgroundElements.map((element) => ({
      ariaHidden: element.getAttribute('aria-hidden'),
      element,
      inert: element.inert,
    }));
    backgroundElements.forEach((element) => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
    panelRef.current
      ?.querySelector<HTMLElement>('[data-drawer-close]')
      ?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      backgroundState.forEach(({ ariaHidden, element, inert }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      });
      const returnTarget = returnFocusRef.current;
      window.requestAnimationFrame(() => {
        if (returnTarget?.isConnected) returnTarget.focus();
      });
    };
  }, [isOpen, returnFocusElement]);

  if (!isOpen) return null;

  function restoreTriggerFocus() {
    const returnTarget = returnFocusRef.current;
    window.requestAnimationFrame(() => {
      returnTarget?.focus({ preventScroll: true });
    });
  }

  function dismiss() {
    onDismiss();
    restoreTriggerFocus();
  }

  function handleKeyDown(event: JSX.TargetedKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
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

  return createPortal(
    <div
      class="ui-drawer-overlay fixed inset-0 z-50 flex min-w-0 items-end md:items-stretch md:justify-end"
      onClick={(event) => {
        if (event.currentTarget === event.target) dismiss();
      }}
      onKeyDown={handleKeyDown}
      ref={overlayRef}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        class="ui-drawer-panel min-w-0 w-full max-w-[100vw] max-h-[calc(100dvh-var(--app-navigation-height)-env(safe-area-inset-bottom))] overflow-x-hidden overflow-y-auto rounded-t-2xl border-t px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] md:h-full md:max-h-none md:max-w-2xl md:rounded-none md:border-t-0 md:border-l md:px-6 md:py-6"
        ref={panelRef}
        role="dialog"
      >
        <div class="ui-drawer-header sticky top-0 z-10 mb-4 flex min-w-0 items-start justify-between gap-4 border-b py-3 md:mb-6 md:pt-0">
          <h2 class="text-xl font-bold" id={titleId}>
            {title}
          </h2>
          <Button
            aria-label={t('common.closePanel')}
            data-drawer-close
            onClick={dismiss}
            size="sm"
            variant="ghost"
          >
            {t('common.close')}
          </Button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
