/* global DOMException, document, navigator, window */

const shareButton = document.querySelector('[data-share-article]');
const shareStatus = document.querySelector('[data-share-status]');

if (shareButton && shareStatus) {
  shareButton.addEventListener('click', async () => {
    const url = shareButton.dataset.canonicalUrl || window.location.href;
    const shareData = { title: document.title, url };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        shareStatus.textContent = shareButton.dataset.sharedLabel || '';
        return;
      }

      await navigator.clipboard.writeText(url);
      shareStatus.textContent = shareButton.dataset.copiedLabel || '';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      shareStatus.textContent = shareButton.dataset.failedLabel || url;
    }
  });
}
