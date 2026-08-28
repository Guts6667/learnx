import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
  PwaInstallSettings,
  PwaProvider,
  PwaStatus,
} from '@/features/pwa/PwaStatus';

const updateServiceWorker = vi.fn(async () => undefined);
const setNeedRefresh = vi.fn();
const setOfflineReady = vi.fn();
let needRefresh = false;
let offlineReady = false;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
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
    needRefresh = false;
    offlineReady = false;
    setNeedRefresh.mockClear();
    setOfflineReady.mockClear();
    updateServiceWorker.mockClear();
    setOnlineStatus(true);
    window.localStorage.clear();
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: defaultUserAgent,
    });
    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      value: false,
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
      screen.getByRole('complementary', { name: 'État de l’application' }),
    ).toBeInTheDocument();
    const [installButton] = screen.getAllByRole('button', {
      name: 'Installer LearnX',
    });
    if (!installButton) throw new Error('Install action not rendered');
    fireEvent.click(installButton);

    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    expect(
      screen.queryAllByRole('button', { name: 'Installer LearnX' }),
    ).toHaveLength(0);
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

    expect(
      screen.getByText(/Sur iPhone, touchez Partager/),
    ).toBeInTheDocument();
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

  it('priorise la mise à jour disponible et expose ses deux actions', async () => {
    needRefresh = true;
    render(
      <PwaProvider>
        <PwaStatus />
      </PwaProvider>,
    );

    expect(
      screen.getByText('Une nouvelle version de LearnX est disponible.'),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Mettre à jour' }));
    await waitFor(() =>
      expect(updateServiceWorker).toHaveBeenCalledWith(true),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
  });

  it('permet de fermer la confirmation de disponibilité hors ligne', () => {
    offlineReady = true;
    render(
      <PwaProvider>
        <PwaStatus />
      </PwaProvider>,
    );

    expect(screen.getByText(/LearnX est prêt pour une utilisation hors connexion/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Mettre à jour' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(setOfflineReady).toHaveBeenCalledWith(false);
  });

  it('affiche les états installé et indisponible dans les réglages', () => {
    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      value: true,
    });
    const installed = render(
      <PwaProvider>
        <PwaInstallSettings />
      </PwaProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'LearnX est déjà installé sur cet appareil.',
    );
    installed.unmount();

    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      value: false,
    });
    render(
      <PwaProvider>
        <PwaInstallSettings />
      </PwaProvider>,
    );
    expect(
      screen.getByText(
        'L’installation est proposée ici lorsqu’elle est disponible sur votre navigateur.',
      ),
    ).toBeVisible();
  });

  it('reste utilisable lorsque le stockage privé refuse lecture et écriture', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    });
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('storage disabled');
      });
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('storage disabled');
      });

    render(
      <PwaProvider>
        <PwaInstallSettings />
      </PwaProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'J’ai compris' }));
    expect(screen.queryByText(/Sur iPhone, touchez Partager/)).toBeNull();

    getItem.mockRestore();
    setItem.mockRestore();
  });

  it('signale clairement un composant utilisé hors de son provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<PwaStatus />)).toThrow('PwaProvider is required.');

    consoleError.mockRestore();
  });
});
