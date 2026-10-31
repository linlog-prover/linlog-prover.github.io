// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { calculus, start } from "./prover";

/** Opens the rules of the formula whose button's name starts with `formula` and picks `name`. */
async function pick(page: Page, formula: string, name: string) {
  await page
    .getByRole("button", { name: new RegExp(`^${formula.replace(/[().$*+?]/g, "\\$&")}, formula`) })
    .first()
    .click();
  await page
    .getByRole("dialog", { name: "Rules" })
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .click();
}

/** Starts an intuitionistic tab on `sequent`. */
async function intuitionistic(page: Page, sequent: string) {
  await start(page, sequent);
  await calculus(page, ["Intuitionistic"]);
}

test("a sequent with quantifiers and terms is proved with a witness typed and one left open", async ({
  page,
}) => {
  await intuitionistic(page, "exists y. forall x. r(x, y) |- forall x. exists y. r(x, y)");
  await pick(page, "∃y. (∀x. r(x, y))", "∃L");
  await pick(page, "∀x. (∃y. r(x, y))", "∀R");
  // ∀L takes a witness: the chooser says so, and leaving it open writes $1.
  await pick(page, "∀x. r(x, a)", "∀L");
  const chooser = page.getByRole("dialog", { name: "Witness" });
  await expect(chooser).toContainText("Witness for ∀L");
  await chooser.getByRole("button", { name: "Leave open" }).click();
  await expect(chooser).toBeHidden();
  await expect(page.getByRole("button", { name: /^r\(\$1, a\), formula/ })).toBeVisible();
  // ∃R with a term that does not read, then with b.
  await pick(page, "∃y. r(b, y)", "∃R");
  await chooser.getByRole("textbox").fill("g(b)");
  await chooser.getByRole("button", { name: "Apply" }).click();
  await expect(chooser.getByRole("alert")).toContainText("no such term");
  await chooser.getByRole("textbox").fill("a");
  await chooser.getByRole("button", { name: "Apply" }).click();
  await expect(chooser).toBeHidden();
  await pick(page, "r(b, a)", "ax");
  await expect(
    page.getByRole("status").filter({ hasText: "Proved: every goal is closed" }),
  ).toBeVisible();
  // The derivation is drawn with its instances, the open witness filled.
  const drawing = page.locator(".drawing svg");
  await expect(drawing).toContainText("∀L");
  await expect(drawing).toContainText("r(b, a)");
});

test("the eigenvariable condition is refused in words", async ({ page }) => {
  await intuitionistic(page, "forall x. exists y. r(x, y) |- exists y. forall x. r(x, y)");
  await pick(page, "∃y. (∀x. r(x, y))", "∃R");
  const chooser = page.getByRole("dialog", { name: "Witness" });
  await chooser.getByRole("button", { name: "Leave open" }).click();
  await pick(page, "∀x. r(x, $1)", "∀R");
  await pick(page, "∀x. (∃y. r(x, y))", "∀L");
  await chooser.getByRole("textbox").fill("a");
  await chooser.getByRole("button", { name: "Apply" }).click();
  await pick(page, "∃y. r(a, y)", "∃L");
  await pick(page, "r(a, b)", "ax");
  const note = page.locator(".dock .kw.bad");
  await expect(note).toHaveText("ax refused: the eigenvariable condition");
  await expect(note).toHaveAttribute("data-tip", /The eigenvariable b cannot stand here/);
});

test("a cut at first order names an eigenvariable made below its goal", async ({ page }) => {
  await intuitionistic(page, "forall x. (p(x) -o q(x)), forall x. p(x) |- forall y. q(y)");
  await pick(page, "∀y. q(y)", "∀R");
  await page.getByRole("button", { name: "Cut", exact: true }).click();
  const chooser = page.getByRole("dialog", { name: "Cut" });
  await chooser.getByRole("textbox").fill("r(a)");
  await chooser.getByRole("button", { name: "Cut", exact: true }).click();
  await expect(chooser.getByRole("alert")).toContainText("r is not in the sequent");
  await chooser.getByRole("textbox").fill("p(a)");
  await page.getByRole("button", { name: /^∀x\. p\(x\), formula/ }).click();
  await chooser.getByRole("button", { name: "Cut", exact: true }).click();
  await expect(chooser).toBeHidden();
  await expect(page.locator(".gn")).toContainText("2 open");
  await page.getByRole("button", { name: "Close all" }).first().click();
  await expect(
    page.getByRole("status").filter({ hasText: "Proved: every goal is closed" }),
  ).toBeVisible();
  await expect(page.locator(".drawing svg")).toContainText("cut");
  await expect(page.locator(".drawing svg")).toContainText("p(a) ⊢ p(a)");
});

test("an undo on one branch replays the other with its eigenvariable's new letter", async ({
  page,
}) => {
  await intuitionistic(
    page,
    "forall x. p(x), forall x. q(x) |- (forall y. p(y)) * (forall y. q(y))",
  );
  await page.getByRole("button", { name: /^\(∀y\. p\(y\)\) ⊗ \(∀y\. q\(y\)\), formula/ }).click();
  await page.getByRole("dialog", { name: "Rules" }).getByRole("button", { name: /^⊗R/ }).click();
  await page
    .getByRole("button", { name: /^∀x\. p\(x\), formula/ })
    .first()
    .click();
  await page
    .getByRole("dialog", { name: "Split" })
    .getByRole("button", { name: /^Apply/ })
    .click();
  await pick(page, "∀y. p(y)", "∀R");
  await pick(page, "∀y. q(y)", "∀R");
  await pick(page, "∀x. q(x)", "∀L");
  const chooser = page.getByRole("dialog", { name: "Witness" });
  await chooser.getByRole("textbox").fill("b");
  await chooser.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("button", { name: /^q\(b\), formula/ }).first()).toBeVisible();
  // Undo the first branch's ∀R: the second's eigenvariable is a now, its witness with it.
  await page
    .getByRole("button", { name: /^p\(a\), formula/ })
    .first()
    .click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: /^q\(a\), formula/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^q\(b\), formula/ })).toHaveCount(0);
});

test("the first-order bounds are settings, and a search says which one stopped it", async ({
  page,
}) => {
  await start(page, "forall x. p(x) |- p(f(f(c)))");
  await page.getByRole("button", { name: "Settings" }).first().click();
  const depth = page.getByRole("spinbutton", { name: "Witness depth" });
  await expect(depth).toHaveValue("64");
  await expect(page.getByRole("spinbutton", { name: "Instances" })).toHaveValue("65536");
  await expect(page.getByRole("spinbutton", { name: "Terms" })).toHaveValue("1000000");
  await depth.fill("1");
  await depth.press("Enter");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Close goal" }).click();
  const note = page.locator(".dock .kw.warn");
  await expect(note).toHaveText("Unknown: gave up");
  await expect(note).toHaveAttribute("data-tip", /Settings' witness depth/);
});
