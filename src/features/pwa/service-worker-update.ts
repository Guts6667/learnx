interface ServiceWorkerControllerSource {
  readonly controller: ServiceWorker | null;
  addEventListener(type: 'controllerchange', listener: EventListener): void;
  removeEventListener(type: 'controllerchange', listener: EventListener): void;
}

/**
 * Reloads an already-controlled page once when a replacement worker takes over.
 * A first installation is deliberately ignored so it cannot create a reload loop.
 */
export function reloadOnServiceWorkerReplacement(
  serviceWorker: ServiceWorkerControllerSource,
  reload: () => void,
): () => void {
  if (!serviceWorker.controller) return () => undefined;

  let replacementHandled = false;
  const handleControllerChange = () => {
    if (replacementHandled) return;
    replacementHandled = true;
    reload();
  };

  serviceWorker.addEventListener('controllerchange', handleControllerChange);

  return () => {
    serviceWorker.removeEventListener(
      'controllerchange',
      handleControllerChange,
    );
  };
}
