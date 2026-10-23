// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// Practice, a place of its own: one test per behaviour, against the built
// site with linlog's real module.

import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { goto, rule, start } from "./prover";

interface Problem {
  id: string;
  sequent: string;
  level: number;
  categories: string[];
}

async function openPractice(page: Page) {
  // After a reload the band is drawn before its island hydrates; a press before that is lost.
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
  await page.locator("footer").getByRole("button", { name: "Practice", exact: true }).click();
  const practice = page.getByRole("dialog", { name: "Practice" });
  await expect(practice.locator(".pr-row").first()).toBeVisible();
  return practice;
}

const shownIds = (page: Page) =>
  page
    .locator(".pr-row")
    .evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset["problem"]));

test("Practice opens from the bottom band, outside Learn's frame, with the store's provable problems alone", async ({
  page,
  request,
}) => {
  await goto(page);
  const practice = await openPractice(page);
  await expect(page.getByRole("complementary", { name: "Learn" })).toHaveCount(0);
  const offered = (await (await request.get("/problems.json")).json()) as Problem[];
  expect(offered.length).toBeGreaterThanOrEqual(300);
  expect(await shownIds(page)).toEqual(offered.map((p) => p.id));
  await expect(practice).toContainText(`${offered.length} of ${offered.length} problems`);
  // Learn's unprovable problems are not among them.
  await expect(practice.getByRole("button", { name: /^Prove A ⊗ B ⊢ A,/ })).toHaveCount(0);
  await expect(practice.getByRole("button", { name: /^Prove A ⊗ B ⊢ B ⊗ A,/ })).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(practice).toBeHidden();
  await page.keyboard.press("p");
  await expect(practice).toBeVisible();
});

test("the filters show the problems of the chosen categories and levels, kept for the next visit", async ({
  page,
  request,
}) => {
  await goto(page);
  const practice = await openPractice(page);
  const offered = (await (await request.get("/problems.json")).json()) as Problem[];
  await practice.getByRole("checkbox", { name: "Additives" }).check();
  await practice.getByRole("checkbox", { name: "Exponentials" }).check();
  await practice.getByRole("checkbox", { name: "Intuitionistic" }).check();
  await practice.getByRole("checkbox", { name: "Hard", exact: true }).check();
  const expected = offered
    .filter(
      (p) =>
        p.level === 3 &&
        (p.categories.includes("additives") || p.categories.includes("exponentials")) &&
        p.categories.includes("intuitionistic"),
    )
    .map((p) => p.id);
  expect(expected.length).toBeGreaterThan(0);
  expect(await shownIds(page)).toEqual(expected);
  await expect(practice).toContainText(`${expected.length} of ${offered.length} problems`);
  await page.reload();
  await openPractice(page);
  expect(await shownIds(page)).toEqual(expected);
  await page.getByRole("button", { name: "Show every problem" }).click();
  expect((await shownIds(page)).length).toBe(offered.length);
});

test("a random problem is one the filters show, and opens on a new tab beside the work open", async ({
  page,
}) => {
  await start(page, "A * B |- B * A");
  const practice = await openPractice(page);
  await practice.getByRole("checkbox", { name: "Units" }).check();
  await practice.getByRole("checkbox", { name: "Very hard" }).check();
  const sequents = await practice.locator(".pr-seq").allTextContents();
  expect(sequents.length).toBeGreaterThan(0);
  await practice.getByRole("button", { name: "A random problem" }).click();
  await expect(practice).toBeHidden();
  await expect(page.locator(".ptab")).toHaveCount(2);
  await expect(page.locator(".ptab").first().locator(".pt-go .m")).toHaveText("A ⊗ B ⊢ B ⊗ A");
  expect(sequents).toContain(
    await page.locator(".ptab[aria-current=true] .pt-go .m").textContent(),
  );
  await expect(page.getByRole("button", { name: /, formula 1 of goal 1/ })).toBeVisible();
});

test("a problem opens on a new tab, and once the visitor proves it, it is marked, also on the next visit", async ({
  page,
}) => {
  await start(page, "A |- A");
  let practice = await openPractice(page);
  const row = practice.getByRole("button", { name: /^Prove A & B ⊢ A,/ });
  await expect(row).not.toContainText("Proved");
  await row.click();
  await expect(page.locator(".ptab")).toHaveCount(2);
  await expect(page.locator(".ptab[aria-current=true] .pt-go .m")).toHaveText("A & B ⊢ A");
  await rule(page, /^A⊥ ⊕ B⊥, formula/, "⊕₁");
  await rule(page, /^A⊥, formula/, "ax");
  await expect(
    page.getByRole("status").filter({ hasText: "Proved: every goal is closed" }),
  ).toBeVisible();
  practice = await openPractice(page);
  await expect(
    practice.getByRole("button", { name: /^Prove A & B ⊢ A, Easy, proved before/ }),
  ).toContainText("Proved");
  await page.reload();
  practice = await openPractice(page);
  await expect(
    practice.getByRole("button", { name: /^Prove A & B ⊢ A, Easy, proved before/ }),
  ).toBeVisible();
});

test("a problem the search closes is not marked proved", async ({ page }) => {
  await goto(page);
  let practice = await openPractice(page);
  await practice.getByRole("button", { name: /^Prove A ⊗ B ⊢ B ⊗ A,/ }).click();
  await page.locator("footer").getByRole("button", { name: "Close all" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Proved: every goal is closed" }),
  ).toBeVisible();
  practice = await openPractice(page);
  await expect(practice.getByRole("button", { name: /^Prove A ⊗ B ⊢ B ⊗ A,/ })).not.toContainText(
    "Proved",
  );
});

test("Practice is in the bottom band at every desktop width", async ({ page }) => {
  for (const width of [641, 800, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    await goto(page);
    const button = page.locator("footer").getByRole("button", { name: "Practice", exact: true });
    await expect(button, `${width}`).toBeVisible();
    const box = await button.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= width, `${width}`).toBe(true);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${width}`).toBe(0);
  }
});
