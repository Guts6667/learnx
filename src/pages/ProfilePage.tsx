import { navigate as route } from '@/app/navigation';
import type { ChangeEvent, FormEvent } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { PageHeader } from '@/components/ui/PageHeader';
import { SelectField } from '@/components/ui/SelectField';
import { Section } from '@/components/ui/Section';
import {
  useCorrectionReuseConsentMutation,
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
  const reuseConsentMutation = useCorrectionReuseConsentMutation();
  const { locale, setLocale, t } = useI18n();
  const [savedLocale, setSavedLocale] = useState<UiLocale>();
  const [consentSaved, setConsentSaved] = useState(false);
  const user = sessionQuery.data?.user;

  async function handleLogout() {
    try {
      await logoutMutation.mutateAsync();
      route('/login', true);
    } catch {
      // Keep the session query unchanged when the server cannot confirm logout.
    }
  }

  async function handleLocaleChange(event: FormEvent<HTMLSelectElement>) {
    const nextLocale = event.currentTarget.value as UiLocale;
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

  async function handleReuseConsentChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const consent = event.currentTarget.checked;
    setConsentSaved(false);
    try {
      await reuseConsentMutation.mutateAsync(consent);
      setConsentSaved(true);
    } catch {
      // La session n'est pas modifiée : la case reprend la valeur enregistrée,
      // jamais celle que le clic espérait.
    }
  }

  if (!user) {
    return null;
  }

  return (
    <section
      aria-labelledby="profile-title"
      className="page-layout page-layout--work page-shell"
    >
      <PageHeader
        description={t('profile.description')}
        eyebrow={t('profile.eyebrow')}
        id="profile-title"
        title={user.displayName}
      />
      <div className="profile-groups">
        <Card className="profile-account p-0">
          <Section
            aria-labelledby="profile-account-title"
            className="px-5 sm:px-6"
          >
            <h2 className="mb-5 text-lg font-medium" id="profile-account-title">
              {t('profile.group.account')}
            </h2>
            <div className="min-w-0">
              <p className="ui-text-muted text-sm">{t('profile.email')}</p>
              <p className="ui-text mt-1 break-all text-base">{user.email}</p>
            </div>
          </Section>
          <Section className="px-5 sm:px-6">
            <SelectField
              description={t('profile.languageDescription')}
              disabled={localeMutation.isPending}
              error={
                localeMutation.error ? t('profile.languageError') : undefined
              }
              id="profile-locale"
              label={t('profile.language')}
              onInput={handleLocaleChange}
              options={[
                { label: t('profile.languageFrench'), value: 'fr' },
                { label: t('profile.languageEnglish'), value: 'en' },
              ]}
              value={locale}
            />
            {savedLocale === locale ? (
              <p className="ui-text-success mt-2 text-sm" role="status">
                {t('profile.languageSaved')}
              </p>
            ) : null}
          </Section>
          <Section className="px-5 sm:px-6">
            <h3 className="mb-3 text-base font-medium">
              {t('profile.reuseConsentTitle')}
            </h3>
            {/*
              V4.5-168. Décoché par défaut, et le défaut EST la décision : un
              consentement se donne, il ne se déduit pas d'un silence. La
              description dit ce que « non » entraîne, parce qu'un refus a lui
              aussi une conséquence — le texte est supprimé plutôt que gardé.
            */}
            <Checkbox
              checked={user.correctionReuseConsent ?? false}
              description={t('profile.reuseConsentDescription')}
              disabled={reuseConsentMutation.isPending}
              error={
                reuseConsentMutation.error
                  ? t('profile.reuseConsentError')
                  : undefined
              }
              id="profile-reuse-consent"
              label={t('profile.reuseConsentLabel')}
              onChange={handleReuseConsentChange}
            />
            {consentSaved ? (
              <p className="ui-text-success mt-2 text-sm" role="status">
                {t('profile.reuseConsentSaved')}
              </p>
            ) : null}
          </Section>
        </Card>
        <Card
          aria-labelledby="profile-access-title"
          className="profile-access space-y-4"
        >
          <h2 className="text-lg font-medium" id="profile-access-title">
            {t('profile.group.access')}
          </h2>
          <div className="flex w-full min-w-0 flex-col gap-3">
            <a
              aria-label={t('profile.openCredits')}
              className="profile-access-action"
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
                className="profile-access-action"
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
          className="profile-device space-y-3"
        >
          <h2 className="text-lg font-medium" id="profile-device-title">
            {t('profile.group.device')}
          </h2>
          <PwaInstallSettings />
        </Card>
        <Card
          aria-labelledby="profile-session-title"
          className="profile-session space-y-4"
        >
          <h2 className="text-lg font-medium" id="profile-session-title">
            {t('profile.group.session')}
          </h2>
          <Button
            className="w-full min-w-0"
            isLoading={logoutMutation.isPending}
            onClick={handleLogout}
            variant="danger"
          >
            {t('profile.logout')}
          </Button>
          {logoutMutation.error ? (
            <p className="ui-text-danger text-sm" role="alert">
              {t('profile.logoutError')}
            </p>
          ) : null}
        </Card>
      </div>
    </section>
  );
}
