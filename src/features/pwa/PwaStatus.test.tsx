import { fireEvent, render, screen, waitFor } from '@testing-library/preact';

import {
  PwaInstallSettings,
  PwaProvider,
  PwaStatus,
} from '@/features/pwa/PwaStatus';

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
  const defaultUserAgent = navigator.userAgent;

  beforeEach(() => {
    setOnlineStatus(true);
    window.localStorage.clear();
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: defaultUserAgent,
    });
  });

  afterEach(() => window.localStorage.clear());

  it('affiche la bannière lorsque le navigateur passe hors ligne', () => {
    render(
      <PwaProvider>
        <PwaStatus />
      </PwaProvider>,
    );

    setOnlineStatus(false);
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
    render(
      <PwaProvider>
        <PwaStatus />
        <PwaInstallSettings />
      </PwaProvider>,
    );

    fireEvent(window, event);
    expect(
      screen.queryByRole('complementary', { name: 'État de l’application' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Installer LearnX' }));

    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByRole('button', { name: 'Installer LearnX' }),
    ).not.toBeInTheDocument();
  });

  it('mémorise la fermeture de l’aide iOS sur cet appareil', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    });
    const firstRender = render(
      <PwaProvider>
        <PwaInstallSettings />
      </PwaProvider>,
    );

    expect(screen.getByText(/Sur iPhone, touchez Partager/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'J’ai compris' }));
    expect(window.localStorage.getItem('learnx:pwa-ios-help-dismissed')).toBe(
      'true',
    );
    firstRender.unmount();

    render(
      <PwaProvider>
        <PwaInstallSettings />
      </PwaProvider>,
    );
    expect(
      screen.queryByText(/Sur iPhone, touchez Partager/),
    ).not.toBeInTheDocument();
  });
});
