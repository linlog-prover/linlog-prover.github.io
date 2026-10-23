// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// The calculus is each tab's own: a goal opened in a new tab keeps the whole mode of the tab
// it came from, and a change of one tab's mode leaves the others alone, across a reload.

import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { rule, start } from "./prover";

/** The current tab's calculus mark. */
const mark = (page: Page) => page.locator(".ptab[aria-current=true] .pt-mark");

/** Sets the current tab's calculus by the stage's switches, before any step. */
async function calculus(page: Page, switches: readonly string[]) {
  for (const name of switches) {
    const button = page.locator(".stage .calc").getByRole("button", { name, exact: true });
    if (await button.count()) await button.click();
    else await page.locator(".stage .calc label.sw", { hasText: name }).click();
  }
}

for (const [label, sequent, switches, shown, formula, name, left] of [
  [
    "intuitionistic",
    "A, A -o B |- B",
    ["Intuitionistic"],
    "ILL",
    /^A ⊗ B⊥, formula/,
    "⊸L",
    /^A⊥, formula/,
  ],
  ["Mix", "|- A * B, ~A, ~B", ["Mix"], "LL+mix", /^A ⊗ B, formula/, "⊗", null],
  ["affine", "|- A * B, ~A, ~B, C", ["Affine"], "LL+aff", /^A ⊗ B, formula/, "⊗", null],
  [
    "intuitionistic affine",
    "A, A -o B, C |- B",
    ["Intuitionistic", "Affine"],
    "ILL+aff",
    /^A ⊗ B⊥, formula/,
    "⊸L",
    /^A⊥, formula/,
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
