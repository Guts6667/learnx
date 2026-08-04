import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect } from 'preact/hooks';

type SetBackTarget = (href: string | null) => void;

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

export function useBackNavigationTarget(href: string) {
  const setBackTarget = useContext(BackNavigationContext);

  useEffect(() => {
    setBackTarget(href);
    return () => setBackTarget(null);
  }, [href, setBackTarget]);
}
