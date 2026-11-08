// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// The web page that was served here installed a service worker at this
// path, scoped to the whole origin, which answers the page from its cache
// before the network is asked. A browser checks the worker's script for a
// change at every visit, so this one replaces it: it takes over at once,
// deletes the old page's caches, unregisters itself and reloads every open
// tab, which then reaches the network and the redirect to the new address.
// It answers no request itself. What the page kept in the browser's storage
// (the stored proofs) is left alone.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith("linlog-site-")).map((key) => caches.delete(key)),
      );
      await self.registration.unregister();
      const tabs = await self.clients.matchAll({ type: "window" });
      await Promise.all(tabs.map((tab) => tab.navigate(tab.url)));
    })(),
  );
});
