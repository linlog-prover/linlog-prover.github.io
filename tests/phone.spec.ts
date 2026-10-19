// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

import { expect, test } from "@playwright/test";

test("the page does not scroll sideways at a phone's width", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
