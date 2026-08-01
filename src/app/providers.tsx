import type { ComponentChildren } from 'preact';

interface AppProvidersProps {
  children: ComponentChildren;
}

export function AppProviders({ children }: AppProvidersProps) {
  return <>{children}</>;
}
