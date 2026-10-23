// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// Light dismiss: a press outside an open menu, pane, sheet or popover closes it, as Escape
// does. A press on the stage that closes one does nothing else (no formula picked, no pan); a
// press on another of the bands' buttons closes it and acts.

import { devices, type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { start } from "./prover";

/**
 * A press on the stage's empty field, right of the drawing and above whatever is open (on a
 * phone a sheet leaves a strip of the stage above it, or none, and then the top band's empty
 * part is pressed): a tap on a touch screen.
 */
async function pressField(page: Page, touch: boolean) {
  // A sheet slides in: measure where it is once it stands still.
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
  const stage = await page.locator(".stage").boundingBox();
  if (!stage) throw new Error("no stage");
  const open = await page
    .locator(".menu, .pop, .mode-warn")
    .evaluateAll((all) => all.map((e) => e.getBoundingClientRect().top));
  // A surface that starts at or above the stage's top covers it there.
  const top = Math.min(stage.y + stage.height * 0.2, ...open.map((t) => Math.max(t, stage.y)));
  // A sheet that covers the whole stage leaves the top band's empty part.
  const free = await page.evaluate(() => {
    const band = document.querySelector("header")?.getBoundingClientRect();
    if (!band) return null;
    const y = band.top + band.height / 2;
    for (let x = band.right - 1; x > band.left; x -= 4) {
      if (document.elementFromPoint(x, y)?.closest("button, input, a") === null) return { x, y };
    }
    return null;
  });
  const at =
    top - stage.y >= 8 || !free
      ? { x: stage.x + stage.width * 0.85, y: (stage.y + top) / 2 }
      : free;
  if (touch) await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
}

/** Opens an action of the bottom band, through More's sheet where the band has no room for it. */
async function band(page: Page, name: string) {
  const button = page.locator("footer").getByRole("button", { name, exact: true });
  if (await button.isVisible()) return button.click();
  await page.locator("footer").getByRole("button", { name: "More" }).click();
  await page.getByRole("dialog", { name: "More" }).getByRole("button", { name }).click();
}

/** Where the drawing's conclusion is: a press that closes something must not pan it. */
const conclusion = (page: Page) => page.locator(".drawing svg text").last().boundingBox();

async function dismissals(page: Page, touch: boolean) {
  await start(page, "A * B |- B * A");
  const drawn = await conclusion(page);
  const closes = async (opened: ReturnType<Page["getByRole"]>) => {
    await expect(opened).toBeVisible();
    await pressField(page, touch);
    await expect(opened).toBeHidden();
    // The press did nothing else: no rule popover, the drawing where it was.
    await expect(page.getByRole("dialog", { name: "Rules" })).toBeHidden();
    expect(await conclusion(page)).toEqual(drawn);
  };
  for (const name of ["Export", "Steps", "Settings", "About"]) {
    await band(page, name);
    await closes(page.getByRole(name === "Export" ? "menu" : "dialog", { name }));
  }
  if (touch) {
    await page.locator("footer").getByRole("button", { name: "More" }).click();
    await closes(page.getByRole("dialog", { name: "More" }));
  }
  const tab = page.locator(".ptab[aria-current=true]");
  await tab.getByRole("button", { name: /^Status/ }).click();
  await closes(page.getByRole("dialog", { name: "Status" }));
  await tab.getByRole("button", { name: /^Calculus/ }).click();
  await closes(page.getByRole("dialog", { name: "Logic" }));
  await page.getByRole("button", { name: /^A⊥ ⅋ B⊥, formula/ }).click();
  const rules = page.getByRole("dialog", { name: "Rules" });
  await expect(rules).toBeVisible();
  await pressField(page, touch);
  await expect(rules).toBeHidden();
  // A rule chosen by a press inside the popover still applies.
  await page.getByRole("button", { name: /^A⊥ ⅋ B⊥, formula/ }).click();
  await rules.getByRole("button", { name: /^⅋/ }).click();
  await expect(page.getByRole("button", { name: /^A⊥, formula/ })).toBeVisible();
  // The restart warning: a press outside keeps the proof, as Escape does.
  // On a phone the switches are the tab's mark's alone.
  if (touch) await tab.getByRole("button", { name: /^Calculus/ }).click();
  await page.getByRole("button", { name: "Intuitionistic", exact: true }).click();
  const warning = page.getByRole("alertdialog", { name: "Restart the proof" });
  await expect(warning).toBeVisible();
  if (touch) {
    // In the mark's popover the warning is inside it; a tap outside closes both.
    await pressField(page, touch);
    await expect(page.getByRole("dialog", { name: "Logic" })).toBeHidden();
  } else {
    await pressField(page, touch);
  }
  await expect(warning).toBeHidden();
  await expect(page.getByRole("button", { name: /^A⊥, formula/ })).toBeVisible();
  // A press on another of the band's buttons closes the open menu and opens its own.
  await band(page, "Export");
  await expect(page.getByRole("menu", { name: "Export" })).toBeVisible();
  await page.locator("footer").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("menu", { name: "Export" })).toBeHidden();
  await expect(page.getByRole("button", { name: /^A⊥ ⅋ B⊥, formula/ })).toBeVisible();
}

test("a press outside a menu, pane or popover closes it and does nothing else on the stage", async ({
  page,
}) => {
  await dismissals(page, false);
});

test.describe("at a phone's width", () => {
  const { defaultBrowserType: _, ...pixel } = devices["Pixel 7"];
  test.use(pixel);

  test("a tap outside a sheet, menu or popover closes it and does nothing else on the stage", async ({
    page,
  }) => {
    await dismissals(page, true);
  });
});
