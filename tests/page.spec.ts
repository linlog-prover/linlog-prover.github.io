// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

import { expect, test } from "./fixtures";

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

test("the policy is in force: inline code the build did not hash is refused", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Sequent" })).toBeVisible();
  const outcome = await page.evaluate(async () => {
    const script = document.createElement("script");
    script.textContent = "window.__ran = true";
    document.body.append(script);
    const box = document.createElement("div");
    box.innerHTML = '<p style="color: red">x</p>';
    document.body.append(box);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const state = window as unknown as { __ran?: boolean; __blocked: string[] };
    const blocked = state.__blocked.splice(0);
    return { ran: state.__ran === true, blocked: blocked.map((b) => b.split(" ")[0]) };
  });
  expect(outcome.ran).toBe(false);
  expect(outcome.blocked).toEqual(expect.arrayContaining(["script-src-elem", "style-src-attr"]));
});
