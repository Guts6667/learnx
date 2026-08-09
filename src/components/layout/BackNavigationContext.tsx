import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect } from 'preact/hooks';

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
  children: ComponentChildren;
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
