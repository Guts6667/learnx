import { QueryClient } from '@tanstack/query-core';
import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext, useState } from 'preact/hooks';

interface AppProvidersProps {
  children: ComponentChildren;
}

const QueryClientContext = createContext<QueryClient | null>(null);

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      }),
  );

  return (
    <QueryClientContext.Provider value={queryClient}>
      {children}
    </QueryClientContext.Provider>
  );
}

export function useAppQueryClient(): QueryClient {
  const queryClient = useContext(QueryClientContext);

  if (!queryClient) {
    throw new Error('useAppQueryClient must be used within AppProviders.');
  }

  return queryClient;
}
