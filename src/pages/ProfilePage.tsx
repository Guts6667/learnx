import { route } from 'preact-router';
import { useState } from 'preact/hooks';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
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
      <PageHeader
        description={t('profile.description')}
        eyebrow={t('profile.eyebrow')}
        id="profile-title"
        title={user.displayName}
      />
      <div class="profile-groups">
        <Card class="profile-account p-0">
          <Section aria-labelledby="profile-account-title" class="px-5 sm:px-6">
            <h2 class="mb-5 text-lg font-medium" id="profile-account-title">
              {t('profile.group.account')}
            </h2>
            <div class="min-w-0">
              <p class="ui-text-muted text-sm">{t('profile.email')}</p>
              <p class="ui-text mt-1 break-all text-base">{user.email}</p>
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
        </Card>
        <Card
          aria-labelledby="profile-access-title"
          class="profile-access space-y-4"
        >
          <h2 class="text-lg font-medium" id="profile-access-title">
            {t('profile.group.access')}
          </h2>
          <div class="flex w-full min-w-0 flex-col gap-3">
            <a
              aria-label={t('profile.openCredits')}
              class="profile-access-action"
              href="/credits"
            >
              <span>
                <strong>{t('profile.creditsTitle')}</strong>
                <small>{t('profile.creditsDescription')}</small>
              </span>
              <span aria-hidden="true">›</span>
            </a>
            {user.role === 'ADMIN' ? (
              <a
                aria-label={t('profile.openAdmin')}
                class="profile-access-action"
                href="/admin"
              >
                <span>
                  <strong>{t('profile.adminTitle')}</strong>
                  <small>{t('profile.adminDescription')}</small>
                </span>
                <span aria-hidden="true">›</span>
              </a>
            ) : null}
          </div>
        </Card>
        <Card
          aria-labelledby="profile-device-title"
          class="profile-device space-y-3"
        >
          <h2 class="text-lg font-medium" id="profile-device-title">
            {t('profile.group.device')}
          </h2>
          <PwaInstallSettings />
        </Card>
        <Card
          aria-labelledby="profile-session-title"
          class="profile-session space-y-4"
        >
          <h2 class="text-lg font-medium" id="profile-session-title">
            {t('profile.group.session')}
          </h2>
          <Button
            class="w-full min-w-0"
            isLoading={logoutMutation.isPending}
            onClick={handleLogout}
            variant="danger"
          >
            {t('profile.logout')}
          </Button>
        </Card>
      </div>
    </section>
  );
}
