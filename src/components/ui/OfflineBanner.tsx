import { classNames } from '@/components/ui/classNames';
import { useI18n } from '@/i18n';

interface OfflineBannerProps {
  class?: string;
  isOffline?: boolean;
  message?: string;
}

export function OfflineBanner({
  class: className,
  isOffline = true,
  message,
}: OfflineBannerProps) {
  const { t } = useI18n();
  if (!isOffline) {
    return null;
  }

  return (
    <div
      aria-label={t('offline.ariaLabel')}
      class={classNames(
        'rounded-xl border border-amber-800 bg-amber-950/70 px-4 py-3 text-sm text-amber-100',
        className,
      )}
      role="status"
    >
      <span class="font-semibold">{t('offline.title')} </span>
      {message ?? t('offline.description')}
    </div>
  );
}
