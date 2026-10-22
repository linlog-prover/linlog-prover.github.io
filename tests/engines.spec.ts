// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// The engines on the page: every search names the engine that did its work
// beside that work, with its source one gesture away; Settings forces one;
// the inverse method's saturation is shown as a checked refutation. And the
// practice set, and the field's Enter while a search runs.

import { expect, test } from "./fixtures";
import { goto, start } from "./prover";

/** Sends the visible proof to intuitionistic mode before any step. */
async function intuitionistic(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Intuitionistic", exact: true }).click();
  await expect(page.locator(".ptab[aria-current=true] .pt-mark")).toContainText("ILL");
}

test("a search names its engine beside its work, with its source on hover and in Learn", async ({
  page,
}) => {
  await start(page, "A & B |- A * B");
  await page.getByRole("button", { name: "Close goal" }).click();
  const chip = page.locator(".dline").getByRole("button", { name: /^By the focused search/ });
  await expect(chip).toHaveText("Focused search");
  await chip.hover();
  await expect(page.getByRole("tooltip")).toContainText("Andreoli 1992");
  await chip.click();
  const reference = page.getByRole("complementary", { name: "Learn" });
  await expect(reference.getByRole("tab", { name: "Reference" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const focus = reference.locator("#engine-focus");
  await expect(focus).toHaveAttribute("data-highlight", "");
  await expect(reference.locator("#engine-focus + dd a")).toHaveAttribute(
    "href",
    "https://doi.org/10.1093/logcom/2.3.297",
  );
  // A graft is marked with its engine beside its rule; the hint names its own.
  await start(page, "A * B |- B * A", false);
  await page.locator("footer").getByRole("button", { name: "Hint" }).click();
  await expect(page.locator(".dline.hint .kw.engine")).toHaveText("Focused search");
  await page.getByRole("button", { name: "Close goal" }).click();
  await expect(page.locator(".drawing svg text.engine")).toHaveText("Focused search");
});

test("a saturation refutation is shown checked, by the inverse method", async ({ page }) => {
  await start(page, "!(a -o a * a * a), !(a -o a), a |- a * (a + 0)");
  await intuitionistic(page);
  await page.getByRole("button", { name: "Close goal" }).click();
  const note = page.locator(".dline");
  await expect(note.locator(".kw.bad")).toHaveText("Unprovable, checked: saturation");
  await expect(note.locator(".kw.engine")).toHaveText("Inverse method");
  await expect(page.locator(".ptab[aria-current=true] .dot")).toHaveAttribute("data-tone", "bad");
  await page.locator("footer").getByRole("button", { name: "Export" }).click();
  await expect(page.getByRole("menuitem", { name: /Not derivable/ })).toHaveAttribute(
    "data-tip",
    /no Rocq certificate/,
  );
});

test("Settings forces an engine: those that take the sequent, the others greyed with why, a refusal at the goal", async ({
  page,
}) => {
  await start(page, "A * B |- B * A");
  await page.locator("footer").getByRole("button", { name: "Settings" }).click();
  const engines = page.getByRole("radiogroup", { name: "Engine" });
  await expect(engines.getByRole("radio", { name: /^Automatic/ })).toBeChecked();
  await expect(engines.getByText("here the focused search")).toBeVisible();
  const twoSided = engines.getByRole("radio", { name: /^Two-sided focused search/ });
  await expect(twoSided).toBeDisabled();
  await expect(twoSided).toHaveAccessibleName(/not in classical mode/);
  await engines.getByRole("radio", { name: /^Proof-net search/ }).check();
  await expect(engines.getByRole("radio", { name: /^Proof-net search/ })).toBeChecked();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Close goal" }).click();
  await expect(page.getByText("Proved: every goal is closed")).toBeVisible();
  await expect(page.locator(".drawing svg text.engine")).toHaveText("Proof-net search");
  // A sequent with a unit is no net's: the forced engine's refusal is said at the goal.
  await start(page, "|- 1, bot", false);
  await page.getByRole("button", { name: "Close goal" }).click();
  await expect(page.locator(".dline .kw.bad")).toHaveText(
    "The proof-net search does not take this goal",
  );
});

test("Enter in the sequent field while a search runs waits for it, and is not lost", async ({
  page,
}) => {
  await start(page, "!(a -o a * a * a), !(a -o a), a |- a * (a + 0)");
  await intuitionistic(page);
  await page.getByRole("button", { name: "Close goal" }).click();
  await page.getByRole("button", { name: "New proof" }).click();
  await page.getByRole("textbox", { name: "Sequent" }).fill("A |- A");
  await page.getByRole("textbox", { name: "Sequent" }).press("Enter");
  await expect(page.getByRole("button", { name: /^A, formula 2 of goal 1/ })).toBeVisible();
  await expect(page.locator(".ptab")).toHaveCount(2);
});

test("practice is grouped by lesson, writes negation as the drawings do, and keeps the answer until asked", async ({
  page,
}) => {
  await goto(page);
  await page.locator("footer").getByRole("button", { name: "Learn" }).click();
  const frame = page.getByRole("complementary", { name: "Learn" });
  await expect(frame.locator("summary.prac-h")).toHaveCount(8);
  const card = frame.locator(".exercise").filter({ hasText: "Two strangers" });
  await expect(card.locator(".ex-seq")).toHaveText("⊢ A⊥, B");
  await expect(frame.locator(".ex-seq").filter({ hasText: "~" })).toHaveCount(0);
  await expect(card.getByText("No proof")).toBeHidden();
  await card.getByLabel("The answer to Two strangers").click();
  await expect(card.getByText("No proof")).toBeVisible();
  await expect(card.locator(".diff")).toHaveAttribute("aria-label", "Difficulty 2 of 3");
});
