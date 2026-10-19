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
    await expect(page.getByRole("textbox", { name: "Sequent" })).toBeVisible();
    expect(errors).toEqual([]);
  }
});

test("a path that holds no page answers 404 with the site's own page", async ({ page }) => {
  const response = await page.goto("/no/such/page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  await page.getByRole("link", { name: "The prover" }).click();
  await expect(page.getByRole("textbox", { name: "Sequent" })).toBeVisible();
});
