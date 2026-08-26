export function navigate(to: string, replace = false): void {
  const destination = new URL(to, window.location.href);

  if (destination.origin !== window.location.origin) {
    window.location.assign(destination.href);
    return;
  }

  const href = `${destination.pathname}${destination.search}${destination.hash}`;
  const method = replace ? 'replaceState' : 'pushState';
  window.history[method]({}, '', href);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
