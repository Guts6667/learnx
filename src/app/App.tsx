import { AppProviders } from '@/app/providers';
import { AppRoutes } from '@/app/routes';
import { normalizeUiLocale } from '@/i18n';

export function App() {
  return (
    <AppProviders locale={normalizeUiLocale(navigator.language)}>
      <AppRoutes />
    </AppProviders>
  );
}
