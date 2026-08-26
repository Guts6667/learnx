import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

interface QueryStateProps {
  error: unknown;
  errorDescription: string;
  isPending: boolean;
  loadingLabel: string;
  onRetry?: () => unknown;
  retryLabel: string;
}

/** Shared loading and recoverable-error contract for server-backed views. */
export function QueryState({
  error,
  errorDescription,
  isPending,
  loadingLabel,
  onRetry,
  retryLabel,
}: QueryStateProps) {
  if (isPending) return <Skeleton label={loadingLabel} />;
  if (!error) return null;

  return (
    <ErrorState
      action={
        onRetry ? (
          <Button onClick={() => void onRetry()}>{retryLabel}</Button>
        ) : undefined
      }
      description={errorDescription}
    />
  );
}
