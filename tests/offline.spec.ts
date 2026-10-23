// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// Offline and installable: the service worker caches the site's own files
// and leaves linlog's documentation at /linlog/, another site on the same
// origin, alone; the manifest meets Chromium's install criteria.

import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { goto } from "./prover";

/** Opens the page and waits until the service worker controls it, its cache written. */
async function controlled(page: Page) {
  await goto(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }),
      );
    }
  });
}

test("after one visit the page proves a sequent with no network", async ({ page, context }) => {
  await controlled(page);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("textbox", { name: "Sequent" }).fill("A * B |- B * A");
  await page.getByRole("textbox", { name: "Sequent" }).press("Enter");
  await page.getByRole("button", { name: "Close goal" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Proved: every goal is closed" }),
  ).toBeVisible();
});

test("the service worker fetches what it caches past the HTTP cache", async ({ page }) => {
  // Pages lets a browser keep a file ten minutes (tests/serve.ts does too): a
  // worker that cached from the HTTP cache after a deployment would keep the
  // old page beside the new files, which the new deployment no longer has.
  // Each response has its own id, so the page the worker cached must not be
  // the one the browser loaded and kept.
  const loaded = await page.goto("/");
  await controlled(page);
  const cached = await page.evaluate(async () => {
    for (const key of await caches.keys()) {
      const page = await (await caches.open(key)).match("/");
      if (page) return page.headers.get("x-github-request-id");
    }
    return null;
  });
  expect(cached).not.toBeNull();
  expect(cached).not.toBe(loaded?.headers()["x-github-request-id"]);
});

test("the service worker leaves linlog's documentation at /linlog/ alone", async ({
  page,
  context,
}) => {
  await controlled(page);
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const key of await caches.keys()) {
      for (const request of await (await caches.open(key)).keys()) urls.push(request.url);
    }
    return urls;
  });
  expect(cached.length).toBeGreaterThan(10);
  expect(cached.filter((url) => new URL(url).pathname.startsWith("/linlog"))).toEqual([]);
  const docs = await page.goto("/linlog/");
  expect(docs?.status()).toBe(200);
  expect(docs?.fromServiceWorker()).toBe(false);
  await expect(page.getByRole("heading", { name: "linlog's documentation" })).toBeVisible();
  // With no network an address of the documentation the browser has not
  // kept is served from nowhere (no worker's fallback), while the prover is.
  await context.setOffline(true);
  await expect(page.goto("/linlog/?unseen")).rejects.toThrow();
  const other = await context.newPage();
  const prover = await other.goto("/");
  expect(prover?.fromServiceWorker()).toBe(true);
});

test("the logo's icons and link preview are served at the sizes the page and the manifest name", async ({
  page,
  request,
}) => {
  await goto(page);
  const named = await page.evaluate(async () => {
    const attr = (selector: string, name: string) =>
      document.querySelector(selector)?.getAttribute(name) ?? "";
    const manifest = (await (await fetch(attr('link[rel="manifest"]', "href"))).json()) as {
      icons: { src: string; sizes: string; type: string; purpose: string }[];
    };
    const og = `${attr('meta[property="og:image:width"]', "content")}x${attr('meta[property="og:image:height"]', "content")}`;
    return [
      ...manifest.icons.map((i) => ({ src: i.src, sizes: i.sizes, type: i.type })),
      ...[...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')].map((l) => ({
        src: l.getAttribute("href") ?? "",
        sizes: l.getAttribute("sizes") ?? "any",
        type: l.type,
      })),
      { src: attr('link[rel="apple-touch-icon"]', "href"), sizes: "180x180", type: "image/png" },
      {
        src: new URL(attr('meta[property="og:image"]', "content")).pathname,
        sizes: og,
        type: "image/png",
      },
      { purposes: manifest.icons.map((i) => i.purpose) },
    ];
  });
  expect(named.at(-1)).toEqual({ purposes: ["any", "any", "maskable"] });
  const files = named.slice(0, -1) as { src: string; sizes: string; type: string }[];
  expect(files.map((f) => f.src)).toEqual([
    "/logo/icon-192.png",
    "/logo/icon-512.png",
    "/logo/icon-maskable-512.png",
    "/logo/favicon-32.png",
    "/logo/square-dark.svg",
    "/logo/apple-touch-icon.png",
    "/logo/og.png",
  ]);
  for (const { src, sizes, type } of files) {
    const response = await request.get(src);
    expect(response.status(), src).toBe(200);
    expect(response.headers()["content-type"], src).toBe(type);
    if (type !== "image/png") continue;
    // A PNG's width and height are the IHDR chunk's first two fields.
    const png = await response.body();
    expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, src).toBe(sizes);
  }
});

test("the web app manifest makes the page installable", async ({ page, context }) => {
  await goto(page);
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    return link ? ((await (await fetch(link.href)).json()) as { scope: string }) : null;
  });
  expect(manifest?.scope).toBe("/");
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  expect(installabilityErrors).toEqual([]);
});
