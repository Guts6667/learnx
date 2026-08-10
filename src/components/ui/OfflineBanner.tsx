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
        'ui-feedback ui-feedback--warning text-sm',
        className,
      )}
      role="status"
    >
      <span class="font-medium">{t('offline.title')} </span>
      {message ?? t('offline.description')}
    </div>
  );
}
