import { route } from 'preact-router';
import { useState } from 'preact/hooks';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { PageHeader } from '@/components/ui/PageHeader';
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
    <section aria-labelledby="profile-title" class="page-shell">
      <PageHeader
        eyebrow={t('profile.eyebrow')}
        id="profile-title"
        title={user.displayName}
      />
      <Card class="max-w-2xl">
        <div class="min-w-0">
          <p class="text-sm text-slate-400">{t('profile.email')}</p>
          <p class="mt-1 break-all text-base text-slate-100">{user.email}</p>
        </div>
        <div class="mt-6 border-t border-slate-800 pt-5">
          <label class="block text-sm font-semibold text-slate-200" for="profile-locale">
            {t('profile.language')}
          </label>
          <p class="mt-1 text-sm leading-6 text-slate-400" id="profile-locale-description">
            {t('profile.languageDescription')}
          </p>
          <select
            aria-describedby="profile-locale-description"
            class="mt-3 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
            disabled={localeMutation.isPending}
            id="profile-locale"
            onInput={handleLocaleChange}
            value={locale}
          >
            <option value="fr">{t('profile.languageFrench')}</option>
            <option value="en">{t('profile.languageEnglish')}</option>
          </select>
          {localeMutation.error ? (
            <p class="mt-2 text-sm text-red-300" role="alert">
              {t('profile.languageError')}
            </p>
          ) : savedLocale === locale ? (
            <p class="mt-2 text-sm text-emerald-200" role="status">
              {t('profile.languageSaved')}
            </p>
          ) : null}
        </div>
        <div
          aria-labelledby="profile-actions-title"
          class="mt-6 space-y-3 border-t border-slate-800 pt-5"
        >
          <h2
            class="text-sm font-semibold text-slate-300"
            id="profile-actions-title"
          >
            {t('profile.actions')}
          </h2>
          <div class="flex w-full min-w-0 flex-col gap-3">
            {user.role === 'ADMIN' ? (
              <NavigationAction
                class="w-full min-w-0 text-center"
                href="/admin"
                variant="secondary"
              >
                {t('profile.openAdmin')}
              </NavigationAction>
            ) : null}
            <Button
              class="w-full min-w-0"
              isLoading={logoutMutation.isPending}
              onClick={handleLogout}
              variant="ghost"
            >
              {t('profile.logout')}
            </Button>
          </div>
        </div>
      </Card>
      <PwaInstallSettings />
    </section>
  );
}
