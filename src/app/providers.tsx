import { QueryClient } from '@tanstack/query-core';
import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext, useState } from 'preact/hooks';

import {
  I18nProvider,
  type UiLocale,
} from '@/i18n';

interface AppProvidersProps {
  children: ComponentChildren;
  locale?: UiLocale;
}

const QueryClientContext = createContext<QueryClient | null>(null);

export function AppProviders({ children, locale }: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            networkMode: 'always',
            retry: false,
          },
        },
      }),
  );
  const initialLocale = locale ?? 'fr';

  return (
    <QueryClientContext.Provider value={queryClient}>
      <I18nProvider locale={initialLocale}>
        {children}
      </I18nProvider>
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
