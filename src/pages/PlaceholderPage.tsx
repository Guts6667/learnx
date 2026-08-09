interface PlaceholderPageProps {
  default?: boolean;
  description?: string;
  path?: string;
  title: string;
}

export function PlaceholderPage({
  description,
  title,
}: PlaceholderPageProps) {
  return (
    <section aria-labelledby="page-title">
      <p class="text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">
        LearnX
      </p>
      <h1 id="page-title" class="mt-3 text-3xl font-bold tracking-tight">
        {title}
      </h1>
      <p class="mt-4 max-w-prose text-base leading-7 text-slate-300">
        {description ?? ''}
      </p>
    </section>
  );
}

interface NotFoundPageProps {
  default?: boolean;
  path?: string;
}

export function NotFoundPage(routeProps: NotFoundPageProps) {
  void routeProps;
  const { t } = useI18n();

  return (
    <section aria-labelledby="page-title">
      <p class="text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">
        {t('notFound.eyebrow')}
      </p>
      <h1 id="page-title" class="mt-3 text-3xl font-bold tracking-tight">
        {t('notFound.title')}
      </h1>
      <p class="mt-4 text-base leading-7 text-slate-300">
        {t('notFound.description')}
      </p>
      <NavigationAction class="mt-6" href="/today">
        {t('notFound.action')}
      </NavigationAction>
    </section>
  );
}
import { NavigationAction } from '@/components/ui/NavigationAction';
import { useI18n } from '@/i18n';
