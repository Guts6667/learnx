import { createContext, type ReactNode } from 'react';
import { useContext, useEffect } from 'react';

import type { MessageKey } from '@/i18n/catalogs';

export interface BackNavigationTarget {
  href: string;
  labelKey: MessageKey;
}

type SetBackTarget = (target: BackNavigationTarget | null) => void;

const BackNavigationContext = createContext<SetBackTarget>(() => undefined);

export function BackNavigationProvider({
  children,
  onTargetChange,
}: {
  children: ReactNode;
  onTargetChange: SetBackTarget;
}) {
  return (
    <BackNavigationContext.Provider value={onTargetChange}>
      {children}
    </BackNavigationContext.Provider>
  );
}

export function useBackNavigationTarget(target: BackNavigationTarget | null) {
  const setBackTarget = useContext(BackNavigationContext);
  const href = target?.href;
  const labelKey = target?.labelKey;

  useEffect(() => {
    setBackTarget(href && labelKey ? { href, labelKey } : null);
    return () => setBackTarget(null);
  }, [href, labelKey, setBackTarget]);
}
