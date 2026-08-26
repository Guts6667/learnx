import { createContext, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useContext, useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { isStandaloneDisplayMode } from '@/features/pwa/display-mode';
import { useOnlineStatus } from '@/features/pwa/online-status';
import { reloadOnServiceWorkerReplacement } from '@/features/pwa/service-worker-update';
import { useI18n } from '@/i18n';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaContextValue {
  dismissIosHelp: () => void;
  installApplication: () => Promise<void>;
  installPrompt: BeforeInstallPromptEvent | null;
  isOnline: boolean;
  needRefresh: boolean;
  offlineReady: boolean;
  setNeedRefresh: (value: boolean) => void;
  setOfflineReady: (value: boolean) => void;
  showIosHelp: boolean;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

const IOS_HELP_DISMISSED_KEY = 'learnx:pwa-ios-help-dismissed';
const PwaContext = createContext<PwaContextValue | null>(null);

function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function readIosHelpDismissed(): boolean {
  try {
    return window.localStorage.getItem(IOS_HELP_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function usePwaContext(): PwaContextValue {
  const value = useContext(PwaContext);
  if (!value) throw new Error('PwaProvider is required.');
  return value;
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const isOnline = useOnlineStatus();
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installHelpDismissed, setInstallHelpDismissed] =
    useState(readIosHelpDismissed);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;

    return reloadOnServiceWorkerReplacement(navigator.serviceWorker, () =>
      window.location.reload(),
    );
  }, []);

  useEffect(() => {
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const clearInstallPrompt = () => setInstallPrompt(null);

    window.addEventListener('beforeinstallprompt', captureInstallPrompt);
    window.addEventListener('appinstalled', clearInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
      window.removeEventListener('appinstalled', clearInstallPrompt);
    };
  }, []);

  async function installApplication() {
    if (!installPrompt) return;

    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  function dismissIosHelp() {
    setInstallHelpDismissed(true);
    try {
      window.localStorage.setItem(IOS_HELP_DISMISSED_KEY, 'true');
    } catch {
      // Device storage can be unavailable in private browsing contexts.
    }
  }

  const showIosHelp =
    isIosDevice() && !isStandaloneDisplayMode() && !installHelpDismissed;

  return (
    <PwaContext.Provider
      value={{
        dismissIosHelp,
        installApplication,
        installPrompt,
        isOnline,
        needRefresh,
        offlineReady,
        setNeedRefresh,
        setOfflineReady,
        showIosHelp,
        updateServiceWorker,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
}

export function PwaStatus({
  showInstallPrompt = true,
}: {
  showInstallPrompt?: boolean;
}) {
  const { t } = useI18n();
  const [installNoticeDismissed, setInstallNoticeDismissed] = useState(false);
  const {
    installApplication,
    installPrompt,
    isOnline,
    needRefresh,
    offlineReady,
    setNeedRefresh,
    setOfflineReady,
    updateServiceWorker,
  } = usePwaContext();
  const canShowInstall =
    showInstallPrompt && Boolean(installPrompt) && !installNoticeDismissed;
  const hasStatus = !isOnline || offlineReady || needRefresh || canShowInstall;

  if (!hasStatus) return null;

  return (
    <aside
      aria-label={t('pwa.status')}
      aria-live="polite"
      className="mx-auto max-w-xl px-5 pt-4"
    >
      {!isOnline ? (
        <OfflineBanner isOffline />
      ) : needRefresh ? (
        <PwaNotice
          actionLabel={t('pwa.update')}
          message={t('pwa.updateAvailable')}
          onAction={() => void updateServiceWorker(true)}
          onDismiss={() => setNeedRefresh(false)}
        />
      ) : offlineReady ? (
        <PwaNotice
          message={t('pwa.ready')}
          onDismiss={() => setOfflineReady(false)}
        />
      ) : canShowInstall ? (
        <PwaNotice
          actionLabel={t('pwa.install')}
          message={t('pwa.installAvailable')}
          onAction={() => void installApplication()}
          onDismiss={() => setInstallNoticeDismissed(true)}
        />
      ) : null}
    </aside>
  );
}

function PwaNotice({
  actionLabel,
  message,
  onAction,
  onDismiss,
}: {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  return (
    <Card className="relative space-y-3 border-[var(--color-accent)] py-4 pr-16">
      <Button
        aria-label={t('common.close')}
        className="absolute top-2 right-2 min-h-11 min-w-11 px-0"
        onClick={onDismiss}
        variant="ghost"
      >
        <span aria-hidden="true" className="text-xl leading-none">
          ×
        </span>
      </Button>
      <p className="text-sm leading-6 text-[var(--color-text)]">{message}</p>
      {actionLabel && onAction ? (
        <Button onClick={onAction} size="sm">
          {actionLabel}
        </Button>
      ) : null}
    </Card>
  );
}

export function PwaInstallSettings() {
  const { t } = useI18n();
  const { dismissIosHelp, installApplication, installPrompt, showIosHelp } =
    usePwaContext();
  const standalone = isStandaloneDisplayMode();

  return (
    <Card aria-labelledby="application-settings-title" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold" id="application-settings-title">
          {t('pwa.application')}
        </h2>
        <p className="ui-text-muted mt-2 text-sm leading-6">
          {t('pwa.description')}
        </p>
      </div>
      {standalone ? (
        <p className="text-sm text-[var(--color-success)]" role="status">
          {t('pwa.installed')}
        </p>
      ) : installPrompt ? (
        <Button onClick={() => void installApplication()} variant="secondary">
          {t('pwa.install')}
        </Button>
      ) : showIosHelp ? (
        <div className="space-y-3">
          <p className="ui-text-muted text-sm leading-6">{t('pwa.iosHelp')}</p>
          <Button onClick={dismissIosHelp} variant="ghost">
            {t('pwa.understood')}
          </Button>
        </div>
      ) : (
        <p className="ui-text-muted text-sm">{t('pwa.unavailable')}</p>
      )}
    </Card>
  );
}
