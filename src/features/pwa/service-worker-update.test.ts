import { reloadOnServiceWorkerReplacement } from '@/features/pwa/service-worker-update';

class ServiceWorkerControllerStub extends EventTarget {
  constructor(public controller: ServiceWorker | null) {
    super();
  }
}

describe('reloadOnServiceWorkerReplacement', () => {
  it('recharge une seule fois lorsqu’une nouvelle version remplace un worker actif', () => {
    const serviceWorker = new ServiceWorkerControllerStub(
      {} as ServiceWorker,
    );
    const reload = vi.fn();
    const cleanup = reloadOnServiceWorkerReplacement(serviceWorker, reload);

    serviceWorker.dispatchEvent(new Event('controllerchange'));
    serviceWorker.dispatchEvent(new Event('controllerchange'));

    expect(reload).toHaveBeenCalledTimes(1);

    cleanup();
    serviceWorker.dispatchEvent(new Event('controllerchange'));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('ne recharge pas lors de la première installation', () => {
    const serviceWorker = new ServiceWorkerControllerStub(null);
    const reload = vi.fn();

    reloadOnServiceWorkerReplacement(serviceWorker, reload);
    serviceWorker.controller = {} as ServiceWorker;
    serviceWorker.dispatchEvent(new Event('controllerchange'));

    expect(reload).not.toHaveBeenCalled();
  });
});
