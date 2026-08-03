import { useRegisterSW } from 'virtual:pwa-register/preact';
import { useEffect, useState } from 'preact/hooks';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { OfflineBanner } from '@/components/ui/OfflineBanner';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const markOnline = () => setIsOnline(true);
    const markOffline = () => setIsOnline(false);

    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);

    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, []);

  return isOnline;
}

export function PwaStatus() {
  const isOnline = useOnlineStatus();
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installHelpDismissed, setInstallHelpDismissed] = useState(false);
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

  const showIosHelp = isIosDevice() && !isStandalone() && !installHelpDismissed;
  const hasStatus =
    !isOnline ||
    offlineReady ||
    needRefresh ||
    Boolean(installPrompt) ||
    showIosHelp;

  if (!hasStatus) return null;

  return (
    <aside
      aria-label="État de l’application"
      aria-live="polite"
      class="mx-auto max-w-xl space-y-3 px-5 pt-4"
    >
      <OfflineBanner isOffline={!isOnline} />

      {offlineReady ? (
        <Card class="flex items-center justify-between gap-3 border-emerald-900 py-3">
          <p class="text-sm text-emerald-100">
            LearnX est prêt pour une consultation hors ligne.
          </p>
          <Button
            onClick={() => setOfflineReady(false)}
            size="sm"
            variant="ghost"
          >
            Fermer
          </Button>
        </Card>
      ) : null}

      {needRefresh ? (
        <Card class="space-y-3 border-cyan-900 py-3">
          <p class="text-sm text-cyan-100">
            Une nouvelle version de LearnX est disponible.
          </p>
          <div class="flex gap-2">
            <Button onClick={() => void updateServiceWorker(true)} size="sm">
              Mettre à jour
            </Button>
            <Button
              onClick={() => setNeedRefresh(false)}
              size="sm"
              variant="ghost"
            >
              Plus tard
            </Button>
          </div>
        </Card>
      ) : null}

      {installPrompt ? (
        <Card class="flex items-center justify-between gap-3 border-cyan-900 py-3">
          <p class="text-sm text-cyan-100">
            Installez LearnX pour y accéder comme une application.
          </p>
          <Button onClick={() => void installApplication()} size="sm">
            Installer
          </Button>
        </Card>
      ) : null}

      {showIosHelp ? (
        <Card class="space-y-3 border-cyan-900 py-3">
          <p class="text-sm text-cyan-100">
            Sur iPhone, touchez Partager puis « Sur l’écran d’accueil » pour
            installer LearnX.
          </p>
          <Button
            onClick={() => setInstallHelpDismissed(true)}
            size="sm"
            variant="ghost"
          >
            J’ai compris
          </Button>
        </Card>
      ) : null}
    </aside>
  );
}
