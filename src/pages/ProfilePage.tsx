import { route } from 'preact-router';
import { useState } from 'preact/hooks';

import { ProductPageHeader } from '@/components/product/ProductPageHeader';
import { ProductRail } from '@/components/product/ProductRail';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { Section } from '@/components/ui/Section';
import {
  useLocaleMutation,
  useLogoutMutation,
  useSessionQuery,
} from '@/features/auth/session';
import { PwaInstallSettings } from '@/features/pwa/PwaStatus';
import { useI18n, type UiLocale } from '@/i18n';

export function ProfilePage() {
  const sessionQuery = useSessionQuery();
  const logoutMutation = useLogoutMutation();
  const localeMutation = useLocaleMutation();
  const { locale, setLocale, t } = useI18n();
  const [savedLocale, setSavedLocale] = useState<UiLocale>();
  const user = sessionQuery.data?.user;

  async function handleLogout() {
    try {
      await logoutMutation.mutateAsync();
      route('/login', true);
    } catch {
      // Keep the session query unchanged when the server cannot confirm logout.
    }
  }

  async function handleLocaleChange(event: Event) {
    const nextLocale = (event.currentTarget as HTMLSelectElement)
      .value as UiLocale;
    const previousLocale = locale;
    setSavedLocale(undefined);
    setLocale(nextLocale);
    try {
      const session = await localeMutation.mutateAsync(nextLocale);
      if (session.user) {
        setLocale(session.user.locale);
        setSavedLocale(session.user.locale);
      }
    } catch {
      setLocale(previousLocale);
    }
  }

  if (!user) {
    return null;
  }

  return (
    <section
      aria-labelledby="profile-title"
      class="page-layout page-layout--work page-shell"
    >
      <ProductPageHeader
        description={t('profile.description')}
        eyebrow={t('profile.eyebrow')}
        id="profile-title"
        summary={{
          description: t('profile.summary.description', {
            language:
              locale === 'fr'
                ? t('profile.languageFrench')
                : t('profile.languageEnglish'),
          }),
          eyebrow: t('profile.summary.eyebrow'),
          title: user.email,
        }}
        title={user.displayName}
      />
      <div class="totem-product-layout">
        <Card class="totem-profile-settings p-0">
          <Section class="px-5 sm:px-6">
            <div class="min-w-0">
              <h2 class="font-medium">{t('profile.email')}</h2>
              <p class="ui-text-muted mt-2 break-all text-sm">{user.email}</p>
            </div>
          </Section>
          <Section class="px-5 sm:px-6">
            <label
              class="ui-text block text-sm font-semibold"
              for="profile-locale"
            >
              {t('profile.language')}
            </label>
            <p
              class="ui-text-muted mt-1 text-sm leading-6"
              id="profile-locale-description"
            >
              {t('profile.languageDescription')}
            </p>
            <select
              aria-describedby="profile-locale-description"
              class="ui-field__control mt-3"
              disabled={localeMutation.isPending}
              id="profile-locale"
              onInput={handleLocaleChange}
              value={locale}
            >
              <option value="fr">{t('profile.languageFrench')}</option>
              <option value="en">{t('profile.languageEnglish')}</option>
            </select>
            {localeMutation.error ? (
              <p class="ui-text-danger mt-2 text-sm" role="alert">
                {t('profile.languageError')}
              </p>
            ) : savedLocale === locale ? (
              <p class="ui-text-success mt-2 text-sm" role="status">
                {t('profile.languageSaved')}
              </p>
            ) : null}
          </Section>
          <Section
            aria-labelledby="profile-actions-title"
            class="space-y-3 px-5 sm:px-6"
          >
            <h2 class="font-medium" id="profile-actions-title">
              {t('profile.actions')}
            </h2>
            <Button
              isLoading={logoutMutation.isPending}
              onClick={handleLogout}
              variant="ghost"
            >
              {t('profile.logout')}
            </Button>
          </Section>
        </Card>
        <ProductRail
          eyebrow={t('profile.application.eyebrow')}
          id="profile-application-title"
          title={t('profile.application.title')}
        >
          <PwaInstallSettings />
          <ul class="totem-product-rows">
            <li class="totem-product-row">
              <span>{t('profile.openCredits')}</span>
              <NavigationAction
                aria-label={t('profile.openCredits')}
                href="/credits"
                variant="ghost"
              >
                {t('common.open')}
              </NavigationAction>
            </li>
            {user.role === 'ADMIN' ? (
              <li class="totem-product-row">
                <span>{t('profile.openAdmin')}</span>
                <NavigationAction
                  aria-label={t('profile.openAdmin')}
                  href="/admin"
                  variant="ghost"
                >
                  {t('common.open')}
                </NavigationAction>
              </li>
            ) : null}
          </ul>
        </ProductRail>
      </div>
    </section>
  );
}
