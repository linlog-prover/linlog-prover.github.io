// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

import { expect, test } from "./fixtures";
import { rule, start } from "./prover";

test("a proof goes at a phone's width, and the page does not scroll sideways", async ({ page }) => {
  await start(page, "A * B |- B * A");
  await rule(page, /^A⊥ ⅋ B⊥/, "⅋");
  await rule(page, /^B ⊗ A/, "⊗");
  await page.getByRole("button", { name: /^B⊥, formula 2/ }).click();
  await page.getByRole("dialog", { name: "Split" }).getByRole("button", { name: "Apply" }).click();
  await page.getByRole("button", { name: "Close all" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Proved: every goal is closed" }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("Learn's frame takes the lower half at a phone's width, with no sideways scroll", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Learn" }).click();
  const frame = page.getByRole("complementary", { name: "Learn" });
  await frame.getByText("2. The multiplicatives").click();
  await frame.getByRole("button", { name: "Prove Tensor commutes" }).click();
  await expect(page.locator(".ptab .pt-go .m")).toHaveText("A ⊗ B ⊢ B ⊗ A");
  const [frameBox, stage] = [await frame.boundingBox(), await page.locator(".stage").boundingBox()];
  expect(frameBox && stage && frameBox.y >= stage.y + stage.height).toBe(true);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
