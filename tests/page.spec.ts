// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

import { expect, test } from "@playwright/test";

test("the page loads without an error in both schemes", async ({ page }) => {
  for (const colorScheme of ["light", "dark"] as const) {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ colorScheme });
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
    expect(errors).toEqual([]);
  }
});
