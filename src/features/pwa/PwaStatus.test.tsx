import { fireEvent, render, screen, waitFor } from '@testing-library/preact';

import { PwaStatus } from '@/features/pwa/PwaStatus';

const updateServiceWorker = vi.fn(async () => undefined);

vi.mock('virtual:pwa-register/preact', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  }),
}));

function setOnlineStatus(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value,
  });
}

describe('PwaStatus', () => {
  beforeEach(() => {
    setOnlineStatus(true);
  });

  it('affiche la bannière lorsque le navigateur passe hors ligne', () => {
    render(<PwaStatus />);

    fireEvent(window, new Event('offline'));

    expect(
      screen.getByRole('status', { name: /hors ligne/i }),
    ).toBeInTheDocument();
  });

  it('propose et déclenche l’installation native disponible', async () => {
    const prompt = vi.fn(async () => undefined);
    const event = new Event('beforeinstallprompt', {
      cancelable: true,
    }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' }>;
    };
    event.prompt = prompt;
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    render(<PwaStatus />);

    fireEvent(window, event);
    fireEvent.click(screen.getByRole('button', { name: 'Installer' }));

    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByRole('button', { name: 'Installer' }),
    ).not.toBeInTheDocument();
  });
});
