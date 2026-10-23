// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// Learn's frame and its places, the examples, the tour and About: one test
// per interaction, against the built site with linlog's real module.

import { expect, test } from "./fixtures";
import { goto } from "./prover";

const CC_BY = "https://creativecommons.org/licenses/by/4.0/";

test("Learn frames the window with the tutorial, practice and reference, and off leaves none", async ({
  page,
}) => {
  await goto(page);
  await expect(page.getByRole("complementary", { name: "Learn" })).toHaveCount(0);
  await page.getByRole("button", { name: "Learn" }).click();
  const frame = page.getByRole("complementary", { name: "Learn" });
  await expect(frame.getByRole("tab", { name: "Practice" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(frame.getByRole("link", { name: "CC BY 4.0" })).toHaveAttribute("href", CC_BY);
  await frame.getByRole("tab", { name: "Tutorial" }).click();
  await expect(frame.locator(".lessons li")).toHaveCount(9);
  await expect(frame.getByRole("button", { name: "Take the tour of the page" })).toBeVisible();
  await frame.getByRole("tab", { name: "Reference" }).click();
  await expect(frame.getByRole("table")).toContainText("linear implication");
  // With Learn on, every action of the bottom band shows its label.
  await expect(page.locator(".band.bottom .lb").filter({ hasText: "Steps" })).toBeVisible();
  await page.keyboard.press("l");
  await expect(frame).toHaveCount(0);
});

test("an example opens at once, and Watch plays its proof one step at a time", async ({ page }) => {
  await goto(page);
  // The empty stage's line opens Practice.
  await page.getByRole("button", { name: "Practice" }).click();
  await page.getByText("6. Two sides").click();
  await page.getByRole("button", { name: "Prove Modus ponens" }).click();
  await expect(page.locator(".ptab")).toHaveCount(1);
  await expect(page.locator(".ptab .pt-go .m")).toHaveText("A, A ⊸ B ⊢ B");
  await expect(page.getByRole("button", { name: /, formula 1 of goal 1/ })).toBeVisible();
  await page.getByText("2. The multiplicatives").click();
  await page.getByText("Answer").and(page.getByLabel("The answer to Tensor commutes")).click();
  await page.getByRole("button", { name: "Watch Tensor commutes" }).click();
  await expect(page.locator(".ptab")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /^A⊥ ⅋ B⊥, formula 1 of goal 1/ })).toBeVisible();
  for (let step = 0; step < 4; step++) {
    await page.getByRole("button", { name: "Redo", exact: true }).click();
  }
  await expect(
    page.getByRole("status").filter({ hasText: "Proved: every goal is closed" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeDisabled();
});

test("the tour walks the page by keyboard and ends on a checked proof", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await goto(page);
  await page.getByRole("button", { name: "Tour" }).click();
  const tour = page.getByRole("dialog", { name: "Tour" });
  await expect(tour).toContainText("The sequent (1 of 8)");
  await expect(page.locator("[aria-live]")).toContainText("Tour, stop 1 of 8");
  for (let stop = 2; stop <= 8; stop++) {
    // Next waits while the stop's step runs, as a keyboard user does.
    await expect(tour.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
    await expect(tour.getByRole("button", { name: "Next", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(tour).toContainText(`(${stop} of 8)`);
  }
  await expect(page.locator("[data-tour-spot]")).toHaveCount(1);
  await expect(page.locator(".ptab .dot")).toHaveAttribute("data-tone", "ok");
  await expect(tour.getByRole("button", { name: "Done" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(tour).toHaveCount(0);
  await expect(page.locator("[data-tour-spot]")).toHaveCount(0);
});

test("About says what the page is, and every licence it lists is served", async ({
  page,
  request,
}) => {
  await goto(page);
  await page.getByRole("button", { name: "About" }).click();
  const about = page.getByRole("dialog", { name: "About" });
  await expect(about).toContainText("nothing you type is sent anywhere");
  await expect(about).toContainText(/linlog \d+\.\d+\.\d+, reading session documents/);
  await expect(about).toContainText(
    "GitHub, which serves this site, logs every visitor's IP address",
  );
  await expect(about.getByRole("img", { name: "linlog" })).toBeVisible();
  await expect(about).toContainText(
    "The name linlog and its mark identify this project, and may not be used to suggest its endorsement of anything else.",
  );
  const licence = (what: string) =>
    about.getByRole("listitem").filter({ hasText: what }).getByRole("link", { name: "CC BY 4.0" });
  await expect(licence("The written content")).toHaveAttribute("href", CC_BY);
  await expect(licence("linlog's logo")).toHaveAttribute("href", "/logo/LICENSE.txt");
  const local = await about
    .getByRole("listitem")
    .getByRole("link")
    .evaluateAll((links) =>
      links.map((a) => a.getAttribute("href") ?? "").filter((href) => href.startsWith("/")),
    );
  expect(local.length).toBe(11);
  for (const href of local) {
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
    expect((await response.text()).length, href).toBeGreaterThan(500);
  }
});

test("with Learn on, the bottom band keeps its actions in one row at 1280 pixels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.locator("footer").getByRole("button", { name: "Learn", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Learn" })).toBeVisible();
  const rows = await page
    .locator("footer .act")
    .evaluateAll(
      (actions) =>
        new Set(
          actions
            .filter((a) => (a as HTMLElement).offsetParent)
            .map((a) => Math.round(a.getBoundingClientRect().top)),
        ).size,
    );
  expect(rows).toBe(1);
});
