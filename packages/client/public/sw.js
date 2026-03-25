/* eslint-disable no-restricted-globals */

self.addEventListener("push", (event) => {
  let data = { title: "Chore App", body: "" };
  try {
    data = event.data?.json() ?? data;
  } catch {
    /* malformed payload — show default notification */
  }

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
  event.waitUntil(clients.openWindow("/").catch(() => {}));
});
