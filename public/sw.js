/* Service worker de Sahelia : reçoit les notifications push, même quand l'application est fermée. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let donnees = {};
  try {
    donnees = event.data ? event.data.json() : {};
  } catch (e) {
    donnees = { body: event.data ? event.data.text() : "" };
  }
  const titre = donnees.title || "Sahelia";
  event.waitUntil(
    self.registration.showNotification(titre, {
      body: donnees.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Une notification avec la même « tag » remplace la précédente au lieu de s'empiler.
      tag: donnees.tag || undefined,
      renotify: Boolean(donnees.tag),
      data: { url: donnees.url || "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // On n'ouvre que des pages de l'application elle-même (jamais une adresse externe).
  let cible = new URL("/notifications", self.location.origin);
  try {
    const demande = new URL(event.notification.data && event.notification.data.url, self.location.origin);
    if (demande.origin === self.location.origin) cible = demande;
  } catch (e) {
    /* adresse invalide : on garde la page des notifications */
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      for (const fenetre of fenetres) {
        if ("focus" in fenetre) {
          if ("navigate" in fenetre) fenetre.navigate(cible.href);
          return fenetre.focus();
        }
      }
      return self.clients.openWindow(cible.href);
    }),
  );
});
