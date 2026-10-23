// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// Math text is set in its font's one weight: never a weight the browser would fake, not even in
// the selected tab's semibold label, and the drawing's glow lies on its line art, not its
// formulas.

import { expect, test } from "./fixtures";
import { proveCommuted } from "./prover";

test("math text keeps its font's weight, and the glow stays off the formulas", async ({ page }) => {
  await proveCommuted(page);
  const sequent = page.locator(".ptab[aria-current=true] .pt-go .m");
  await expect(sequent).toHaveCSS("font-weight", "400");
  await expect(sequent).toHaveCSS("font-synthesis-weight", "none");
  const drawing = page.locator(".drawing svg").first();
  await expect(drawing).toHaveCSS("filter", "none");
  await expect(page.locator(".drawing svg text").first()).toHaveCSS(
    "font-synthesis-weight",
    "none",
  );
  await expect(page.locator(".drawing svg g[stroke]").first()).not.toHaveCSS("filter", "none");
});
