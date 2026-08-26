import type { ReactNode } from 'react';

import { AppQueryProvider } from '@/app/query-provider';
import { I18nProvider, type UiLocale } from '@/i18n';

interface AppProvidersProps {
  children: ReactNode;
  locale?: UiLocale;
}

export function AppProviders({ children, locale }: AppProvidersProps) {
  const initialLocale = locale ?? 'fr';

  return (
    <AppQueryProvider>
      <I18nProvider locale={initialLocale}>{children}</I18nProvider>
    </AppQueryProvider>
  );
}

export { useAppQueryClient } from '@/app/query-provider';
