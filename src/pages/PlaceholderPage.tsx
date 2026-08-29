import { PublicPageShell } from '@/components/layout/PublicPageShell';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { useI18n } from '@/i18n';

interface NotFoundPageProps {
  default?: boolean;
  path?: string;
}

export function NotFoundPage(routeProps: NotFoundPageProps) {
  void routeProps;
  const { t } = useI18n();

  return (
    <PublicPageShell className="landing-page public-not-found-shell">
      <section aria-labelledby="page-title" className="page-shell page-layout">
        <p className="page-eyebrow">{t('notFound.eyebrow')}</p>
        <h1 id="page-title" className="page-title mt-3">
          {t('notFound.title')}
        </h1>
        <p className="ui-text-muted mt-4 text-base leading-7">
          {t('notFound.description')}
        </p>
        <NavigationAction className="mt-6" href="/today">
          {t('notFound.action')}
        </NavigationAction>
      </section>
    </PublicPageShell>
  );
}
