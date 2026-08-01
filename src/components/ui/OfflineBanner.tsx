import { classNames } from '@/components/ui/classNames';

interface OfflineBannerProps {
  class?: string;
  isOffline?: boolean;
  message?: string;
}

export function OfflineBanner({
  class: className,
  isOffline = true,
  message = 'Certaines actions nécessitent une connexion internet.',
}: OfflineBannerProps) {
  if (!isOffline) {
    return null;
  }

  return (
    <div
      aria-label="Vous êtes hors ligne"
      class={classNames(
        'rounded-xl border border-amber-800 bg-amber-950/70 px-4 py-3 text-sm text-amber-100',
        className,
      )}
      role="status"
    >
      <span class="font-semibold">Vous êtes hors ligne. </span>
      {message}
    </div>
  );
}
