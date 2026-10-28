// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

import { expect, test } from "./fixtures";
import { calculus, start } from "./prover";

/** Cuts the active goal on `formula`, the goal's formulas named by `left` going to the premise proving it. */
async function cut(page: import("@playwright/test").Page, formula: string, left: RegExp[]) {
  await page.getByRole("button", { name: "Cut", exact: true }).click();
  const chooser = page.getByRole("dialog", { name: "Cut" });
  await chooser.getByRole("textbox").fill(formula);
  for (const name of left) await page.getByRole("button", { name }).first().click();
  await chooser.getByRole("button", { name: "Cut", exact: true }).click();
  await expect(chooser).toBeHidden();
}

/** Starts `A, A ⊸ B ⊢ B`, cuts it on `A ⊸ B` and closes both premises by the search. */
async function provedWithCut(page: import("@playwright/test").Page) {
  await start(page, "A, A -o B |- B");
  await cut(page, "A -o B", [/^A ⊗ B⊥, formula 2/]);
  await page.getByRole("button", { name: "Close all" }).first().click();
  await expect(
    page.getByRole("status").filter({ hasText: "Proved: every goal is closed" }),
  ).toBeVisible();
}

test("a cut is typed in the tab's syntax, its formulas chosen, and both premises open", async ({
  page,
}) => {
  await start(page, "A, A -o B |- B");
  await page.getByRole("button", { name: "Cut", exact: true }).click();
  const chooser = page.getByRole("dialog", { name: "Cut" });
  await chooser.getByRole("textbox").fill("A -o");
  await chooser.getByRole("button", { name: "Cut", exact: true }).click();
  await expect(chooser.getByRole("alert")).toContainText("does not parse");
  await chooser.getByRole("textbox").fill("A -o B");
  await page.getByRole("button", { name: /^A ⊗ B⊥, formula 2/ }).click();
  await expect(chooser.locator(".prem").first()).toContainText("A ⊗ B⊥");
  await chooser.getByRole("button", { name: "Cut", exact: true }).click();
  await expect(chooser).toBeHidden();
  await expect(page.locator(".gn")).toContainText("2 open");
  // The first premise proves the cut formula, the second uses its dual.
  await expect(page.getByRole("button", { name: /^A ⊗ B⊥, formula 1 of goal 2/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^A⊥ ⅋ B, formula 2 of goal 2/ })).toBeVisible();

  // In intuitionistic logic the formula is typed in its syntax, and the goals read so.
  await start(page, "A, A -o B, B -o C |- C", false);
  await calculus(page, ["Intuitionistic"]);
  await cut(page, "B", [/^A, formula 1/, /^A ⊸ B, formula 2/]);
  await expect(page.locator(".gn")).toContainText("2 open");
  await expect(page.locator(".drawing svg")).toContainText("cut");
});

test("a proof's cuts are eliminated step by step on the derivation, each step undoable", async ({
  page,
}) => {
  await provedWithCut(page);
  const panel = page.getByRole("region", { name: "Cut elimination" });
  await expect(panel).toContainText("1 cut in this proof");
  await panel.getByRole("button", { name: "Eliminate the cuts" }).click();
  await expect(panel.getByRole("status")).toHaveText("1 cut left");
  const next = page.getByRole("button", { name: /^Reduce the cut of .*, the strategy's next$/ });
  await expect(next).toBeVisible();
  await expect(page.locator(".drawing svg .next-cut").first()).toBeAttached();

  // The strategy's step, named by its case; before it, the reduced cut highlighted.
  await panel.getByRole("button", { name: "Next step" }).click();
  await expect(panel.getByRole("status")).toContainText(/^1\. .+ on the cut of /);
  const first = await panel.getByRole("status").textContent();
  await panel.getByRole("button", { name: "Before" }).click();
  await expect(page.locator(".drawing svg .reduced").first()).toBeAttached();
  await expect(panel.getByRole("status")).toContainText("Before 1.");
  await panel.getByRole("button", { name: "Before" }).click();

  // Undone, then the same cut picked on the drawing: the same step.
  await panel.getByRole("button", { name: "Undo step" }).click();
  await expect(panel.getByRole("status")).toHaveText("1 cut left");
  await next.click();
  await expect(panel.getByRole("status")).toHaveText(first ?? "");

  // To the end, then each of its steps undone alone.
  await panel.getByRole("button", { name: "To the end" }).click();
  await expect(panel.getByRole("status")).toContainText("Cut-free");
  const status = (await panel.getByRole("status").textContent()) ?? "";
  const steps = Number(/^(\d+)\./.exec(status)?.[1]);
  expect(steps).toBeGreaterThan(1);
  await panel.getByRole("button", { name: "Undo step" }).click();
  await expect(panel.getByRole("status")).toContainText(`${steps - 1}. `);
  await panel.getByRole("button", { name: "Leave" }).click();
  await expect(panel.getByRole("button", { name: "Eliminate the cuts" })).toBeVisible();
});

test("a proof's cut links are eliminated step by step on its net", async ({ page }) => {
  await provedWithCut(page);
  await page.getByRole("tab", { name: "Net" }).click();
  const panel = page.getByRole("region", { name: "Cut elimination" });
  await panel.getByRole("button", { name: "Eliminate the cuts" }).click();
  await expect(panel).toContainText("on the net");
  await expect(page.locator(".drawing svg path[id^='c']").first()).toBeAttached();
  await page
    .getByRole("button", { name: /^Reduce the cut of / })
    .first()
    .click();
  await expect(panel.getByRole("status")).toContainText(/^1\. .+ on the cut of /);
  await panel.getByRole("button", { name: "Before" }).click();
  await expect(
    page.locator(".drawing svg path.reduced, .drawing svg [id^='c']").first(),
  ).toBeAttached();
  await panel.getByRole("button", { name: "Before" }).click();
  await panel.getByRole("button", { name: "To the end" }).click();
  await expect(panel.getByRole("status")).toContainText("Cut-free");
  await panel.getByRole("button", { name: "Undo step" }).click();
  await expect(panel.getByRole("status")).not.toContainText("Cut-free");
});

test("an elimination to the end says which bound stopped it", async ({ page }) => {
  await provedWithCut(page);
  await page.getByRole("button", { name: "Settings" }).click();
  const steps = page.getByRole("spinbutton", { name: "Elimination steps" });
  await steps.fill("1");
  await steps.press("Enter");
  await page.keyboard.press("Escape");
  const panel = page.getByRole("region", { name: "Cut elimination" });
  await panel.getByRole("button", { name: "Eliminate the cuts" }).click();
  await panel.getByRole("button", { name: "To the end" }).click();
  await expect(panel.getByRole("alert")).toContainText("Stopped after 1 step");
  await expect(panel.getByRole("alert")).toContainText("most steps allowed");
});
