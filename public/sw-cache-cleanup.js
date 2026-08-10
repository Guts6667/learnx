/* global caches, self */

const LEGACY_PRIVATE_CACHE_NAMES = [
  'learnx-pedagogy-v1',
  'learnx-public-shell-v0',
];

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all(
      LEGACY_PRIVATE_CACHE_NAMES.map((cacheName) => caches.delete(cacheName)),
    ),
  );
});
