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
  // Started: the field gave way to the proof, or said why it could not.
  await expect(page.locator(".stage .fb, [role=alert]").first()).toBeVisible();
}

/** The current tab's calculus switches, opened from its mark if they are not open yet. */
export async function switches(page: Page) {
  const pop = page.getByRole("dialog", { name: "Logic" });
  if (!(await pop.isVisible())) await page.locator(".ptab[aria-current=true] .pt-mark").click();
  await expect(pop).toBeVisible();
  return pop;
}

/** Sets the current tab's calculus by its mark's switches, before any step, and closes them. */
export async function calculus(page: Page, names: readonly string[]) {
  const pop = await switches(page);
  for (const name of names) {
    const button = pop.getByRole("button", { name, exact: true });
    if (await button.count()) await button.click();
    else await pop.locator("label.sw", { hasText: name }).click();
  }
  await page.keyboard.press("Escape");
  await expect(pop).toBeHidden();
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
