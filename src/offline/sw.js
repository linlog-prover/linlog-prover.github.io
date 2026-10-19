// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// The service worker that lets the site work with no network after one
// visit. The build (src/integrations/offline.ts) writes it to /sw.js with
// the two constants below filled in: FILES, every file of the site by its
// path, and VERSION, a hash of their contents, so that a new deployment is
// a new worker.
//
// Its scope is the whole origin, since a worker at /sw.js cannot be scoped
// narrower than / and the page is at /; but linlog's documentation at
// /linlog/ is another site on the same origin, and nothing of it passes
// through here. The worker answers only requests for the site's own files
// (FILES) and navigations to the prover's page; every other request,
// /linlog/ above all, goes to the network as if there were no worker, and
// where the browser can route by pattern (the Static Routing API) requests
// under /linlog never reach the worker at all.
//
// The cache is written whole when the worker installs, and a new worker
// waits until no page of the old one is open: a page and the files it asks
// for later (the module, its worker, the fonts) always come from one
// deployment.

const FILES = [];
const VERSION = "";

const PREFIX = "linlog-site-";
const CACHE = PREFIX + VERSION;
const OWN = new Set(FILES);

/** Whether a path is linlog's own Pages site, which this worker never touches. */
const isLinlog = (path) => path === "/linlog" || path.startsWith("/linlog/");

self.addEventListener("install", (event) => {
  const routed = event.addRoutes
    ? event
        .addRoutes([
          { condition: { urlPattern: "/linlog" }, source: "network" },
          { condition: { urlPattern: "/linlog/*" }, source: "network" },
        ])
        .catch(() => undefined)
    : Promise.resolve();
  event.waitUntil(Promise.all([routed, caches.open(CACHE).then((cache) => cache.addAll(FILES))]));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || isLinlog(url.pathname)) {
    return;
  }
  const page =
    request.mode === "navigate" && (url.pathname === "/" || url.pathname === "/index.html");
  const path = page ? "/" : url.pathname;
  if (!OWN.has(path) || (request.mode === "navigate" && !page)) return;
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(path))
      .then((cached) => cached ?? fetch(request)),
  );
});
