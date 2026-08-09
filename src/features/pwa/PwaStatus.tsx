import { createContext, type ComponentChildren } from 'preact';
import { useRegisterSW } from 'virtual:pwa-register/preact';
import { useContext, useEffect, useState } from 'preact/hooks';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { useOnlineStatus } from '@/features/pwa/online-status';
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

function isStandalone(): boolean {
  return (
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
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

export function PwaProvider({ children }: { children: ComponentChildren }) {
  const isOnline = useOnlineStatus();
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installHelpDismissed, setInstallHelpDismissed] = useState(
    readIosHelpDismissed,
  );
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

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

  const showIosHelp = isIosDevice() && !isStandalone() && !installHelpDismissed;

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

export function PwaStatus() {
  const { t } = useI18n();
  const {
    isOnline,
    needRefresh,
    offlineReady,
    setNeedRefresh,
    setOfflineReady,
    updateServiceWorker,
  } = usePwaContext();
  const hasStatus = !isOnline || offlineReady || needRefresh;

  if (!hasStatus) return null;

  return (
    <aside
      aria-label={t('pwa.status')}
      aria-live="polite"
      class="mx-auto max-w-xl space-y-3 px-5 pt-4"
    >
      <OfflineBanner isOffline={!isOnline} />

      {offlineReady ? (
        <Card class="flex items-center justify-between gap-3 border-emerald-900 py-3">
          <p class="text-sm text-emerald-100">
            {t('pwa.ready')}
          </p>
          <Button
            onClick={() => setOfflineReady(false)}
            size="sm"
            variant="ghost"
          >
            {t('common.close')}
          </Button>
        </Card>
      ) : null}

      {needRefresh ? (
        <Card class="space-y-3 border-cyan-900 py-3">
          <p class="text-sm text-cyan-100">
            {t('pwa.updateAvailable')}
          </p>
          <div class="flex gap-2">
            <Button onClick={() => void updateServiceWorker(true)} size="sm">
              {t('pwa.update')}
            </Button>
            <Button
              onClick={() => setNeedRefresh(false)}
              size="sm"
              variant="ghost"
            >
              {t('pwa.later')}
            </Button>
          </div>
        </Card>
      ) : null}
    </aside>
  );
}

export function PwaInstallSettings() {
  const { t } = useI18n();
  const {
    dismissIosHelp,
    installApplication,
    installPrompt,
    showIosHelp,
  } = usePwaContext();
  const standalone = isStandalone();

  return (
    <Card
      aria-labelledby="application-settings-title"
      class="max-w-2xl space-y-4"
    >
      <div>
        <h2 class="text-lg font-semibold" id="application-settings-title">
          {t('pwa.application')}
        </h2>
        <p class="mt-2 text-sm leading-6 text-slate-300">
          {t('pwa.description')}
        </p>
      </div>
      {standalone ? (
        <p class="text-sm text-emerald-200" role="status">
          {t('pwa.installed')}
        </p>
      ) : installPrompt ? (
        <Button onClick={() => void installApplication()} variant="secondary">
          {t('pwa.install')}
        </Button>
      ) : showIosHelp ? (
        <div class="space-y-3">
          <p class="text-sm leading-6 text-slate-300">
            {t('pwa.iosHelp')}
          </p>
          <Button onClick={dismissIosHelp} variant="ghost">
            {t('pwa.understood')}
          </Button>
        </div>
      ) : (
        <p class="text-sm text-slate-400">
          {t('pwa.unavailable')}
        </p>
      )}
    </Card>
  );
}
