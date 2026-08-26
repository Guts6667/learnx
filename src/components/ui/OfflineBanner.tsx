import { classNames } from '@/components/ui/classNames';
import { useI18n } from '@/i18n';

interface OfflineBannerProps {
  className?: string;
  isOffline?: boolean;
  message?: string;
}

export function OfflineBanner({
  className,
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
      className={classNames(
        'ui-feedback ui-feedback--warning text-sm',
        className,
      )}
      role="status"
    >
      <span className="font-medium">{t('offline.title')} </span>
      {message ?? t('offline.description')}
    </div>
  );
}
