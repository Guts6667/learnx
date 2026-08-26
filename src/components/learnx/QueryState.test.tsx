import { fireEvent, render, screen } from '@testing-library/react';

import { QueryState } from '@/components/learnx/QueryState';

describe('QueryState', () => {
  it('announces loading without exposing an error action', () => {
    render(
      <QueryState
        error={undefined}
        errorDescription="Impossible de charger."
        isPending
        loadingLabel="Chargement du programme"
        retryLabel="Réessayer"
      />,
    );

    expect(screen.getByText('Chargement du programme')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers an explicit retry for a recoverable server error', () => {
    const onRetry = vi.fn();
    render(
      <QueryState
        error={new Error('Unavailable')}
        errorDescription="Impossible de charger."
        isPending={false}
        loadingLabel="Chargement"
        onRetry={onRetry}
        retryLabel="Réessayer"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
