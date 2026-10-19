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
  // With no network the documentation is not served from anywhere, while the prover is.
  await context.setOffline(true);
  await expect(page.goto("/linlog/")).rejects.toThrow();
  const prover = await page.goto("/");
  expect(prover?.fromServiceWorker()).toBe(true);
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
