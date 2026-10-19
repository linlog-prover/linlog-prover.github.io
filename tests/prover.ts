// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// The steps the prover's tests share.

import { expect, type Page } from "@playwright/test";

/** Opens the page and waits for the sequent field. */
export async function goto(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Sequent" })).toBeVisible();
}

/** Starts a sequent: on a fresh page, or as a new proof beside the open ones. */
export async function start(page: Page, sequent: string, fresh = true) {
  if (fresh) await goto(page);
  else await page.getByRole("button", { name: "New proof" }).click();
  await page.getByRole("textbox", { name: "Sequent" }).fill(sequent);
  await page.getByRole("textbox", { name: "Sequent" }).press("Enter");
}

/** Applies a rule to the active goal's formula whose name matches. */
export async function rule(page: Page, formula: RegExp, name: string) {
  await page.getByRole("button", { name: formula }).first().click();
  await page
    .getByRole("dialog", { name: "Rules" })
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .click();
}

/** Proves A ⊗ B ⊢ B ⊗ A by the search. */
export async function proveCommuted(page: Page) {
  await start(page, "A * B |- B * A");
  await page.getByRole("button", { name: "Close goal" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Proved: every goal is closed" }),
  ).toBeVisible();
}
