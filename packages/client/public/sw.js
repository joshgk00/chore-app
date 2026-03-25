/* eslint-disable no-restricted-globals */

// Service worker for push notifications
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? { title: "Chore App", body: "" };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon.ico",
      data: data.data,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
