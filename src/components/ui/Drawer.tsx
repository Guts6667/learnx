import type { ReactNode } from 'react';

import { OverlayDialog } from '@/components/ui/Dialog';

interface DrawerProps {
  children: ReactNode;
  isOpen: boolean;
  onDismiss: () => void;
  returnFocusElement?: HTMLElement | null;
  title: string;
}

export function Drawer({
  children,
  isOpen,
  onDismiss,
  returnFocusElement,
  title,
}: DrawerProps) {
  return (
    <OverlayDialog
      className="ui-drawer-content"
      isOpen={isOpen}
      onDismiss={onDismiss}
      placement="drawer"
      returnFocusElement={returnFocusElement}
      title={title}
    >
      {children}
    </OverlayDialog>
  );
}
