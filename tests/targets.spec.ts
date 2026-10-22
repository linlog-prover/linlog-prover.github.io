// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// Every control of the page, in every state the page can be put in, is a
// target of at least 44 by 44 pixels at a phone's width and of at least 24
// by 24 (WCAG 2.2, 2.5.8) at a desktop's: measured where it is drawn. A link
// inside a sentence is WCAG's inline exception and is not measured.

import { devices, type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { goto, rule, start } from "./prover";

/** Every visible control too small for the floor, described. */
async function tooSmall(page: Page, least: number): Promise<string[]> {
  return page.evaluate((least) => {
    const controls = document.querySelectorAll<HTMLElement>(
      "button, input:not([type=checkbox]), select, textarea, summary, a[href], [role=tab], [role=radio], label.sw",
    );
    const small: string[] = [];
    for (const control of controls) {
      if (!control.checkVisibility({ visibilityProperty: true, opacityProperty: false })) continue;
      if (control.closest(".sr-only, [aria-hidden=true]")) continue;
      // A checkbox's switch is measured as its label, which it covers.
      if (control.closest("label.sw") && control !== control.closest("label.sw")) continue;
      // A link in running text: the inline exception.
      if (control instanceof HTMLAnchorElement) {
        const parent = control.parentElement;
        const text = [...(parent?.childNodes ?? [])].some(
          (n) => n !== control && (n.textContent ?? "").trim() !== "",
        );
        if (text && getComputedStyle(control).display === "inline") continue;
      }
      const r = control.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (Math.round(r.width) < least || Math.round(r.height) < least) {
        const name =
          control.getAttribute("aria-label") ??
          control.textContent?.trim().slice(0, 40) ??
          control.className;
        small.push(
          `${control.tagName.toLowerCase()}.${control.className} "${name}" ${Math.round(r.width)}×${Math.round(r.height)}`,
        );
      }
    }
    return small;
  }, least);
}

/**
 * Puts the page through its states, measuring the controls in each: the
 * empty page, a proof with the rule popover, the split chooser, a refusal,
 * a hint, a proof closed and its net, every menu, the status and the
 * calculus, the restart warning, Learn's three places, the tour, a field's
 * parse error, and the restore bar.
 */
async function walk(page: Page, least: number, phone: boolean) {
  const found: string[] = [];
  const measure = async (state: string) => {
    for (const small of await tooSmall(page, least)) found.push(`${state}: ${small}`);
  };
  const band = async (name: string) => {
    const button = page.locator("footer").getByRole("button", { name, exact: true });
    if (!(await button.isVisible())) {
      await page.locator("footer").getByRole("button", { name: "More" }).click();
      await measure("more");
      await page.getByRole("dialog", { name: "More" }).getByRole("button", { name }).click();
    } else {
      await button.click();
    }
  };
  await goto(page);
  await measure("empty");
  await page.getByRole("textbox", { name: "Sequent" }).fill("A *");
  await page.getByRole("textbox", { name: "Sequent" }).press("Enter");
  await expect(page.getByRole("alert")).toBeVisible();
  await measure("parse error");
  await start(page, "A * B |- B * A", false);
  await measure("started");
  await page.getByRole("button", { name: /^A⊥ ⅋ B⊥, formula/ }).click();
  await expect(page.getByRole("dialog", { name: "Rules" })).toBeVisible();
  await measure("rules");
  await page.keyboard.press("Escape");
  await rule(page, /^A⊥ ⅋ B⊥, formula/, "⅋");
  await rule(page, /^B ⊗ A, formula/, "⊗");
  await page.getByRole("button", { name: /^B⊥, formula/ }).click();
  await expect(page.getByRole("dialog", { name: "Split" })).toContainText("Passes");
  await measure("split");
  await page.getByRole("dialog", { name: "Split" }).getByRole("button", { name: "Cancel" }).click();
  await rule(page, /^A⊥, formula/, "ax");
  await expect(page.locator(".dline .kw.bad")).toBeVisible();
  await measure("refusal");
  await band("Hint");
  await expect(page.locator(".dline.hint")).toContainText("Work on this goal");
  await measure("hint");
  await page.locator("footer").getByRole("button", { name: "Close all" }).click();
  await expect(page.getByText("Proved: every goal is closed")).toBeVisible();
  await measure("proved");
  await page.getByRole("tab", { name: "Net" }).click();
  await measure("net");
  await page.getByRole("tab", { name: "Tree" }).click();
  for (const menu of ["Export", "Steps", "Import", "Settings", "Keys", "About"]) {
    await band(menu);
    await expect(
      page.getByRole(menu === "Export" ? "menu" : "dialog", { name: menu }),
    ).toBeVisible();
    await measure(menu);
    await page.keyboard.press("Escape");
  }
  const tab = page.locator(".ptab[aria-current=true]");
  await tab.getByRole("button", { name: /^Status/ }).click();
  await measure("status");
  await page.keyboard.press("Escape");
  await tab.getByRole("button", { name: /^Calculus/ }).click();
  await measure("calculus mark");
  await page.keyboard.press("Escape");
  if (phone) await page.locator("footer").getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "Intuitionistic", exact: true }).click();
  await expect(page.getByRole("alertdialog", { name: "Restart the proof" })).toBeVisible();
  await measure("restart warning");
  await page.getByRole("button", { name: "Keep the proof" }).click();
  if (phone) await page.keyboard.press("Escape");
  await band("Learn");
  for (const place of ["Practice", "Tutorial", "Reference"]) {
    await page.getByRole("tab", { name: place }).click();
    await measure(`Learn ${place}`);
  }
  await page.getByRole("button", { name: "Turn Learn off" }).click();
  await band("Tour");
  await expect(page.getByRole("dialog", { name: "Tour" })).toBeVisible();
  await measure("tour");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByRole("region", { name: "Restore" })).toBeVisible();
  await measure("restore");
  return found;
}

/** The stage in each math font: a proof started, the rule popover, and the split chooser. */
async function fonts(page: Page, least: number): Promise<string[]> {
  const found: string[] = [];
  for (const font of ["stix-two", "garamond", "asana", "new-computer-modern"]) {
    await page.evaluate(
      (f) => localStorage.setItem("linlog-settings", JSON.stringify({ stageFont: f })),
      font,
    );
    await start(page, "A * B |- B * A");
    await expect(page.locator(".drawing svg")).not.toHaveAttribute("font-family", /Euler/);
    for (const small of await tooSmall(page, least)) found.push(`${font}, started: ${small}`);
    await rule(page, /^A⊥ ⅋ B⊥, formula/, "⅋");
    await rule(page, /^B ⊗ A, formula/, "⊗");
    await expect(page.getByRole("dialog", { name: "Split" })).toBeVisible();
    for (const small of await tooSmall(page, least)) found.push(`${font}, split: ${small}`);
  }
  return found;
}

test("every control is a target of 24 by 24 pixels at least, at a desktop's width", async ({
  page,
}) => {
  expect(await walk(page, 24, false)).toEqual([]);
});

test.describe("at a phone's width", () => {
  const { defaultBrowserType: _, ...pixel } = devices["Pixel 7"];
  test.use(pixel);

  test("every control is a target of 44 by 44 pixels at least", async ({ page }) => {
    expect(await walk(page, 44, true)).toEqual([]);
  });

  test("the stage's controls stay 44 by 44 pixels in every math font", async ({ page }) => {
    await goto(page);
    expect(await fonts(page, 44)).toEqual([]);
  });
});

test("the stage's controls stay 24 by 24 pixels in every math font, at a desktop's width", async ({
  page,
}) => {
  await goto(page);
  expect(await fonts(page, 24)).toEqual([]);
});
