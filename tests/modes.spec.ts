// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// The calculus is each tab's own: a goal opened in a new tab keeps the whole mode of the tab
// it came from, and a change of one tab's mode leaves the others alone, across a reload. Its
// switches are on the tab's mark alone, and the status writes it in their words.

import { devices, type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { calculus, rule, start } from "./prover";

/** The current tab's calculus mark. */
const mark = (page: Page) => page.locator(".ptab[aria-current=true] .pt-mark");

for (const [label, sequent, switches, shown, formula, name, left] of [
  [
    "intuitionistic",
    "A, A -o B |- B",
    ["Intuitionistic"],
    "ILL",
    /^A ⊸ B, formula/,
    "⊸L",
    /^A, formula/,
  ],
  ["Mix", "|- A * B, ~A, ~B", ["Mix"], "LL+mix", /^A ⊗ B, formula/, "⊗", null],
  ["affine", "|- A * B, ~A, ~B, C", ["Affine"], "LL+aff", /^A ⊗ B, formula/, "⊗", null],
  [
    "intuitionistic affine",
    "A, A -o B, C |- B",
    ["Intuitionistic", "Affine"],
    "ILL+aff",
    /^A ⊸ B, formula/,
    "⊸L",
    /^A, formula/,
  ],
] as const) {
  test(`a goal of a tab in ${label} logic opens in a new tab in the same calculus`, async ({
    page,
  }) => {
    await start(page, sequent);
    await calculus(page, switches);
    await expect(mark(page)).toContainText(shown);
    // A goal below the root: a step first.
    await rule(page, formula, name);
    const split = page.getByRole("dialog", { name: "Split" });
    if (left) await page.getByRole("button", { name: left }).first().click();
    if (await split.isVisible()) await split.getByRole("button", { name: "Apply" }).click();
    await expect(split).toBeHidden();
    await page.getByRole("button", { name: "Open this goal in a new tab" }).click();
    await expect(page.locator(".ptab")).toHaveCount(2);
    await expect(mark(page)).toContainText(shown);
    await expect(page.locator(".stage .fb").first()).toBeVisible();
  });
}

test("each tab keeps its own calculus, across a reload", async ({ page }) => {
  await start(page, "A * B |- B * A");
  await start(page, "|- A * B, ~A, ~B", false);
  await calculus(page, ["Mix"]);
  await start(page, "A, A -o B |- B", false);
  await calculus(page, ["Intuitionistic", "Affine"]);
  const marks = () => page.locator(".ptab .pt-mark").allTextContents();
  await expect.poll(marks).toEqual(["LLMLL", "LL+mixMLL", "ILL+affIMLL"]);
  // A change of one tab's calculus leaves the others alone.
  await page.locator(".ptab").nth(1).locator(".pt-go").click();
  await calculus(page, ["Affine"]);
  await expect.poll(marks).toEqual(["LLMLL", "LL+aff+mixMLL", "ILL+affIMLL"]);
  await page.waitForTimeout(500);
  await page.goto("/");
  await page.getByRole("button", { name: "Restore" }).click();
  await expect.poll(marks).toEqual(["LLMLL", "LL+aff+mixMLL", "ILL+affIMLL"]);
});

/** Opens the current tab's calculus switches by its mark, by a press or by a key. */
async function openMark(page: Page, key: boolean) {
  const chip = page.locator(".ptab[aria-current=true] .pt-mark");
  if (key) {
    await chip.focus();
    await page.keyboard.press("Enter");
  } else {
    await chip.click();
  }
  return page.getByRole("dialog", { name: "Logic" });
}

for (const phone of [false, true]) {
  test.describe(phone ? "at a phone's width" : "at a desktop's width", () => {
    if (phone) {
      const { defaultBrowserType: _, ...pixel } = devices["Pixel 7"];
      test.use(pixel);
    }

    test("the calculus's switches are on the tab's mark alone, never on the stage", async ({
      page,
    }) => {
      await start(page, "A, A -o B |- B");
      const calculusGroup = page.getByRole("group", { name: "Calculus" });
      await expect(page.locator(".stage .fb").first()).toBeVisible();
      await expect(calculusGroup).toHaveCount(0);
      const pop = await openMark(page, false);
      await expect(pop.getByRole("group", { name: "Calculus" })).toBeVisible();
      await expect(calculusGroup).toHaveCount(1);
      await expect(page.locator(".stage").getByRole("group", { name: "Calculus" })).toHaveCount(0);
    });

    test("the tab's calculus mark opens its switches, by a press and by a key", async ({
      page,
    }) => {
      await start(page, "|- A * B, ~A, ~B");
      const switches = await openMark(page, false);
      // Shown, not clipped by the row of tabs: its middle is its own.
      const shown = await switches.evaluate((pop) => {
        const r = pop.getBoundingClientRect();
        return pop.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
      });
      expect(shown).toBe(true);
      await switches.locator("label.sw", { hasText: "Mix" }).click();
      await expect(mark(page)).toContainText("LL+mix");
      await page.keyboard.press("Escape");
      await expect(switches).toBeHidden();
      // By the keyboard: the switches take the focus, and Escape gives it back to the mark.
      await openMark(page, true);
      await expect(switches).toBeVisible();
      expect(await switches.evaluate((pop) => pop.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Escape");
      await expect(switches).toBeHidden();
      await expect(mark(page)).toBeFocused();
      // A new tab's calculus is set by its mark before it starts.
      await page.getByRole("button", { name: "New proof" }).click();
      await (await openMark(page, false))
        .getByRole("button", {
          name: "Intuitionistic",
          exact: true,
        })
        .click();
      await expect(mark(page)).toContainText("ILL");
      if (phone) {
        // The switches have left More's sheet.
        await page.keyboard.press("Escape");
        await page.locator("footer").getByRole("button", { name: "More" }).click();
        const more = page.getByRole("dialog", { name: "More" });
        await expect(more).toBeVisible();
        await expect(more.getByRole("group", { name: "Calculus" })).toHaveCount(0);
      }
    });
  });
}

test("a goal's hypothesis A ⊸ B opens in a new tab as A ⊸ B, and the split chooser lists the formulas as they read", async ({
  page,
}) => {
  await start(page, "A -o B |- A -o B");
  await calculus(page, ["Intuitionistic"]);
  // The formulas' buttons are named as they read: the hypothesis and the goal both A ⊸ B.
  await expect(page.getByRole("button", { name: /^A ⊸ B, formula/ })).toHaveCount(2);
  await rule(page, /^A ⊸ B, formula 2/, "⊸R");
  await page.getByRole("button", { name: "Open this goal in a new tab" }).click();
  await expect(page.locator(".ptab")).toHaveCount(2);
  await expect(page.locator(".ptab[aria-current=true] .pt-go .m")).toHaveText("A ⊸ B, A ⊢ B");
  await expect(mark(page)).toContainText("ILL");
  // The split of ⊸L in the new tab: the lists say A and B, not their one-sided forms.
  await rule(page, /^A ⊸ B, formula/, "⊸L");
  const split = page.getByRole("dialog", { name: "Split" });
  await expect(split.locator(".prem").first()).toHaveText(/^Left\s*nothing else$/);
  await expect(split.locator(".prem").last()).toHaveText(/^Right\s*A, B$/);
  await page
    .getByRole("button", { name: /^A, formula/ })
    .first()
    .click();
  await expect(split.locator(".prem").first()).toHaveText(/^Left\s*A$/);
  await expect(split.locator(".prem").last()).toHaveText(/^Right\s*B$/);
});

test("the status popover writes the calculus in the switches' words", async ({ page }) => {
  await start(page, "A |- A");
  await calculus(page, ["Intuitionistic", "Affine"]);
  await expect(mark(page)).toContainText("ILL+aff");
  await page
    .locator(".ptab[aria-current=true]")
    .getByRole("button", { name: /^Status/ })
    .click();
  const status = page.getByRole("dialog", { name: "Status" });
  await expect(status.locator("dt", { hasText: "Calculus" }).locator("+ dd")).toHaveText(
    "Intuitionistic, affine",
  );
  await expect(status).not.toContainText("intuitionistic-affine");
});
