// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

import type { Locator } from "@playwright/test";
import { expect, test } from "./fixtures";

test("the page loads without an error in both schemes", async ({ page }) => {
  for (const colorScheme of ["light", "dark"] as const) {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ colorScheme });
    await page.goto("/");
    await expect(page.getByRole("textbox", { name: "Sequent" })).toBeVisible();
    expect(errors).toEqual([]);
  }
});

test("a path that holds no page answers 404 with the site's own page", async ({ page }) => {
  const response = await page.goto("/no/such/page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  await page.getByRole("link", { name: "The prover" }).click();
  await expect(page.getByRole("textbox", { name: "Sequent" })).toBeVisible();
});

test("the policy is in force: inline code the build did not hash is refused", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Sequent" })).toBeVisible();
  const outcome = await page.evaluate(async () => {
    const script = document.createElement("script");
    script.textContent = "window.__ran = true";
    document.body.append(script);
    const box = document.createElement("div");
    box.innerHTML = '<p style="color: red">x</p>';
    document.body.append(box);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const state = window as unknown as { __ran?: boolean; __blocked: string[] };
    const blocked = state.__blocked.splice(0);
    return { ran: state.__ran === true, blocked: blocked.map((b) => b.split(" ")[0]) };
  });
  expect(outcome.ran).toBe(false);
  expect(outcome.blocked).toEqual(expect.arrayContaining(["script-src-elem", "style-src-attr"]));
});

test("the header and the 404 page show linlog's word mark, its ring in the logo's colour", async ({
  page,
}) => {
  const ring = (mark: Locator) =>
    mark.locator("path[stroke]").evaluate((path: Element) => getComputedStyle(path).stroke);
  for (const [scheme, colour] of [
    ["light", "rgb(107, 70, 207)"],
    ["dark", "rgb(149, 138, 213)"],
  ] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/");
    const mark = page.locator("header.band.top").getByRole("img", { name: "linlog" });
    await expect(mark).toBeVisible();
    expect((await mark.boundingBox())?.height).toBeCloseTo(24, 0);
    expect(await ring(mark)).toBe(colour);
    await page.goto("/no-such-page");
    const home = page.getByRole("link", { name: "linlog", exact: true });
    await expect(home).toHaveAttribute("href", "/");
    await expect(home.getByRole("img", { name: "linlog" })).toBeVisible();
    expect(await ring(home)).toBe(colour);
  }
});

test("the pictograms are Lucide's, hidden from a screen reader, each action named", async ({
  page,
}) => {
  await page.goto("/");
  const icons = page.locator(".band svg.lucide");
  expect(await icons.count()).toBeGreaterThanOrEqual(14);
  for (const icon of await icons.all()) {
    await expect(icon).toHaveAttribute("aria-hidden", "true");
    await expect(icon).toHaveAttribute("class", /lucide-[a-z0-9-]+/);
  }
  // An icon alone names its action, and shows its tip on focus as on hover.
  for (const name of ["Undo", "Redo", "New proof"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeAttached();
  }
  await page.getByRole("button", { name: "New proof" }).focus();
  await expect(page.getByRole("tooltip")).toHaveText(/A new proof/);
});

test("the privacy page is served, names who is responsible, cites a source for each statement, and About and the band link it", async ({
  page,
}) => {
  const response = await page.goto("/privacy/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
  const main = page.locator("main");
  await expect(main).toContainText("Fabian Lukas Grubmüller");
  await expect(page.getByRole("link", { name: "privacy@grubmueller.dev" })).toHaveAttribute(
    "href",
    "mailto:privacy@grubmueller.dev",
  );
  await expect(main).not.toContainText("Impressum");
  // Every citation leads to a listed source, and every source is cited.
  const cited = new Set(
    await page.locator("a.cite").evaluateAll((links) => links.map((a) => a.getAttribute("href"))),
  );
  const listed = await page
    .locator(".sources li")
    .evaluateAll((items) => items.map((li) => `#${li.id}`));
  expect([...cited].sort()).toEqual([...listed].sort());
  await expect(main).toContainText("information, not legal advice");

  await page.goto("/");
  await page.locator("footer").getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/privacy\/$/);
  await page.goto("/");
  await page.locator("footer").getByRole("button", { name: "About" }).click();
  const line = page.getByRole("dialog", { name: "About" }).locator(".privacy");
  await expect(line).toContainText("logs every visitor's IP address");
  await line.getByRole("link", { name: "the privacy page" }).click();
  await expect(page).toHaveURL(/\/privacy\/$/);
  await page.goto("/no/such/page");
  await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy/");
});
