import { AppRoutes } from '@/app/routes';
import { I18nProvider, normalizeUiLocale } from '@/i18n';

export function App() {
  return (
    <I18nProvider locale={normalizeUiLocale(navigator.language)}>
      <AppRoutes />
    </I18nProvider>
  );
}
