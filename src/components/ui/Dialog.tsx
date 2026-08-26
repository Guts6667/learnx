import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ReactNode, RefObject } from 'react';
import { useId, useRef } from 'react';

import { Button } from '@/components/ui/Button';
import { classNames } from '@/components/ui/classNames';
import { useI18n } from '@/i18n';

type DialogPlacement = 'center' | 'drawer';

export interface OverlayDialogProps {
  children: ReactNode;
  className?: string;
  description?: string;
  dismissOnInteractOutside?: boolean;
  initialFocusElement?: HTMLElement | null;
  initialFocusRef?: RefObject<HTMLElement | null>;
  isOpen: boolean;
  onDismiss: () => void;
  placement: DialogPlacement;
  returnFocusElement?: HTMLElement | null;
  role?: 'alertdialog' | 'dialog';
  title: string;
}

export type DialogProps = Omit<OverlayDialogProps, 'placement'>;

function focusElement(element: HTMLElement | null | undefined) {
  if (!element?.isConnected) return;
  element.focus({ preventScroll: true });
}

/**
 * Controlled modal backed by Radix. Focus trapping, Escape, outside dismissal,
 * aria hiding and scroll locking stay owned by one vetted primitive.
 */
export function Dialog(props: DialogProps) {
  return <OverlayDialog {...props} placement="center" />;
}

export function OverlayDialog({
  children,
  className,
  description,
  dismissOnInteractOutside = true,
  initialFocusElement,
  initialFocusRef,
  isOpen,
  onDismiss,
  placement,
  returnFocusElement,
  role = 'dialog',
  title,
}: OverlayDialogProps) {
  const { t } = useI18n();
  const generatedId = useId();
  const descriptionId = description
    ? `dialog-description-${generatedId}`
    : undefined;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const fallbackReturnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <DialogPrimitive.Root
      onOpenChange={(nextIsOpen) => {
        if (!nextIsOpen) onDismiss();
      }}
      open={isOpen}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ui-dialog-overlay" />
        <DialogPrimitive.Content
          aria-describedby={descriptionId}
          aria-modal="true"
          className={classNames(
            'ui-dialog-content',
            `ui-dialog-content--${placement}`,
            placement === 'drawer' && 'ui-drawer-panel',
            className,
          )}
          onCloseAutoFocus={(event) => {
            const focusTarget =
              returnFocusElement ?? fallbackReturnFocusRef.current;
            if (!focusTarget) return;
            event.preventDefault();
            window.requestAnimationFrame(() => {
              focusElement(focusTarget);
            });
          }}
          onInteractOutside={(event) => {
            if (!dismissOnInteractOutside) event.preventDefault();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const activeElement =
              document.activeElement instanceof HTMLElement &&
              document.activeElement !== document.body
                ? document.activeElement
                : null;
            fallbackReturnFocusRef.current =
              returnFocusElement ?? activeElement;
            focusElement(
              initialFocusRef?.current ??
                initialFocusElement ??
                closeButtonRef.current,
            );
          }}
          role={role}
        >
          <header
            className={classNames(
              'ui-dialog-header',
              placement === 'drawer' && 'ui-drawer-header',
            )}
          >
            <div className="min-w-0">
              <DialogPrimitive.Title className="ui-dialog-title">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description
                  className="ui-dialog-description"
                  id={descriptionId}
                >
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <Button
                aria-label={t('common.closePanel')}
                data-dialog-close
                data-drawer-close={placement === 'drawer' ? '' : undefined}
                elementRef={closeButtonRef}
                size="sm"
                variant="ghost"
              >
                {t('common.close')}
              </Button>
            </DialogPrimitive.Close>
          </header>
          <div className="ui-dialog-body">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
