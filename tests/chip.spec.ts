// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// A proof's tab: its calculus mark reads as a label of its own, a step of the spacing scale
// further from the sequent than its parts from each other, and the phone's tab still fits its
// row beside the new proof's `+`.

import { devices, type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { start } from "./prover";

/** The gaps on the screen: the sequent's end to the mark's text, and the calculus to the fragment. */
async function gaps(page: Page): Promise<{ sequent: number; parts: number }> {
  return page.locator(".ptab[aria-current=true]").evaluate((tab) => {
    const text = (element: Element | null) => {
      const node = [...(element?.childNodes ?? [])].find((n) => n.nodeType === Node.TEXT_NODE);
      const range = document.createRange();
      if (node) range.selectNodeContents(node);
      return range.getBoundingClientRect();
    };
    const sequent = text(tab.querySelector(".pt-go .m"));
    const mark = tab.querySelector(".pt-mark");
    const calculus = text(mark);
    const fragment = mark?.querySelector(".frag")?.getBoundingClientRect();
    return {
      sequent: calculus.left - sequent.right,
      parts: (fragment?.left ?? 0) - calculus.right,
    };
  });
}

test("the calculus mark stands apart from the sequent, its calculus and fragment a word apart", async ({
  page,
}) => {
  await start(page, "A * B |- B * A");
  await expect(page.locator(".ptab[aria-current=true] .pt-mark")).toContainText("MLL");
  const { sequent, parts } = await gaps(page);
  expect(sequent).toBeGreaterThanOrEqual(16);
  expect(parts).toBeGreaterThanOrEqual(8);
  expect(sequent).toBeGreaterThan(parts);
});

test.describe("at a phone's width", () => {
  const { defaultBrowserType: _, ...pixel } = devices["Pixel 7"];
  test.use(pixel);

  test("the mark stands apart, and the tab and the new proof's + fit the row", async ({ page }) => {
    await start(page, "A * B |- B * A");
    const { sequent, parts } = await gaps(page);
    expect(sequent).toBeGreaterThanOrEqual(16);
    expect(parts).toBeGreaterThanOrEqual(8);
    const width = page.viewportSize()?.width ?? 0;
    for (const part of [".ptab[aria-current=true]", ".pt-new"]) {
      const box = await page.locator(part).boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= width, part).toBe(true);
    }
  });
});
