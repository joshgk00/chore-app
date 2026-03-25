/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | { url: string; revision: string | null })[];
};

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const CACHEABLE_API_PATHS = [
  '/api/app/bootstrap',
  '/api/routines',
  '/api/chores',
  '/api/rewards',
  '/api/badges',
  '/api/activity/recent',
  '/api/points/summary',
  '/api/points/ledger',
];

registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    CACHEABLE_API_PATHS.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`)),
  new NetworkFirst({ networkTimeoutSeconds: 3 }),
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/assets/'),
  new CacheFirst({
    cacheName: 'assets-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
);

self.addEventListener('push', (event) => {
  const fallback = { title: 'Chore App', body: '', data: undefined };
  let data: { title: string; body: string; data?: unknown } = fallback;
  try {
    data = event.data?.json() ?? fallback;
  } catch {
    /* malformed payload -- show default notification */
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      data: data.data,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/').catch(() => {}));
});
