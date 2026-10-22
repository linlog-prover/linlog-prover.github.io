// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// Zoom by the platform's own gestures: on the stage a pinch of two fingers and ctrl with the
// wheel zoom the drawing about where they happen, and one finger still pans it; everywhere else
// nothing keeps the browser from zooming the page (WCAG 2.2, 1.4.4), by a pinch, by ctrl with
// the wheel or by ctrl with plus and minus.

import { type CDPSession, devices, type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { proveCommuted } from "./prover";

/** The stage's zoom, in per cent, as its control shows it. */
async function zoomed(page: Page): Promise<number> {
  return Number.parseInt((await page.locator(".zoom-v").textContent()) ?? "", 10);
}

/** Where the drawing's conclusion is drawn, its centre on the screen. */
async function conclusion(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator(".drawing svg text").last().boundingBox();
  if (!box) throw new Error("no drawing");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Two fingers put down `from` pixels either side of `at`, moved apart to `to`, lifted. */
async function pinch(cdp: CDPSession, at: { x: number; y: number }, from: number, to: number) {
  const points = (d: number) => [
    { x: at.x - d, y: at.y, id: 1 },
    { x: at.x + d, y: at.y, id: 2 },
  ];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points(from) });
  for (let i = 1; i <= 10; i++) {
    const d = from + ((to - from) * i) / 10;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: points(d) });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/**
 * What would keep the browser from zooming the page outside the stage: a viewport that forbids
 * it, an element there whose touch-action leaves no pinch to the browser, and a listener that
 * cancels ctrl with the wheel or ctrl with plus or minus.
 */
async function blockers(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "";
    if (/user-scalable\s*=\s*(no|0)|maximum-scale/.test(viewport))
      found.push(`viewport ${viewport}`);
    const stage = document.querySelector(".stage");
    const outside = [...document.querySelectorAll<HTMLElement>("body, body *")].filter(
      (e) => !stage?.contains(e),
    );
    for (const element of outside) {
      const action = getComputedStyle(element).touchAction;
      if (!["auto", "manipulation"].includes(action) && !action.includes("pinch-zoom"))
        found.push(
          `touch-action ${action} on ${element.tagName.toLowerCase()}.${element.className}`,
        );
    }
    for (const element of [
      document.body,
      document.querySelector("header"),
      document.querySelector("footer"),
      document.querySelector(".ptab"),
    ]) {
      if (!element) continue;
      const wheel = new WheelEvent("wheel", {
        ctrlKey: true,
        deltaY: -100,
        bubbles: true,
        cancelable: true,
      });
      if (!element.dispatchEvent(wheel))
        found.push(`ctrl and the wheel cancelled on ${element.tagName}`);
      for (const key of ["+", "=", "-"]) {
        const press = new KeyboardEvent("keydown", {
          key,
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        });
        if (!element.dispatchEvent(press))
          found.push(`ctrl and ${key} cancelled on ${element.tagName}`);
      }
    }
    return found;
  });
}

test("ctrl with the wheel zooms the drawing about the pointer, and nothing blocks the page's zoom outside the stage", async ({
  page,
}) => {
  await proveCommuted(page);
  const before = await zoomed(page);
  const at = await conclusion(page);
  await page.mouse.move(at.x, at.y);
  await page.keyboard.down("Control");
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -100);
  await page.keyboard.up("Control");
  await expect.poll(() => zoomed(page)).toBeGreaterThan(before * 1.5);
  // The point under the pointer stays under it.
  const after = await conclusion(page);
  expect(Math.abs(after.x - at.x)).toBeLessThan(4);
  expect(Math.abs(after.y - at.y)).toBeLessThan(4);
  // The page stayed at its own scale: the wheel over the stage is the drawing's.
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
  await page.getByRole("button", { name: "Export" }).click();
  expect(await blockers(page)).toEqual([]);
});

test.describe("on a touch screen", () => {
  const { defaultBrowserType: _, ...pixel } = devices["Pixel 7"];
  test.use(pixel);

  test("a pinch zooms the drawing about the fingers, one finger pans it, and a pinch outside the stage zooms the page", async ({
    page,
  }) => {
    await proveCommuted(page);
    const cdp = await page.context().newCDPSession(page);
    const before = await zoomed(page);
    const at = await conclusion(page);
    await pinch(cdp, at, 30, 75);
    await expect.poll(() => zoomed(page)).toBeGreaterThan(before * 2);
    // The point between the fingers stays between them.
    const after = await conclusion(page);
    expect(Math.abs(after.x - at.x)).toBeLessThan(4);
    expect(Math.abs(after.y - at.y)).toBeLessThan(4);
    expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
    // One finger pans and leaves the zoom.
    const zoom = await zoomed(page);
    const stage = await page.locator(".stage").boundingBox();
    if (!stage) throw new Error("no stage");
    const field = { x: stage.x + stage.width * 0.8, y: stage.y + stage.height * 0.3 };
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...field, id: 1 }],
    });
    for (let i = 1; i <= 5; i++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: field.x - 12 * i, y: field.y + 8 * i, id: 1 }],
      });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    const panned = await conclusion(page);
    expect(Math.round(panned.x - after.x)).toBe(-60);
    expect(Math.round(panned.y - after.y)).toBe(40);
    expect(await zoomed(page)).toBe(zoom);
    // Outside the stage the browser's own pinch zooms the page.
    expect(await blockers(page)).toEqual([]);
    const band = await page.locator("header").boundingBox();
    if (!band) throw new Error("no band");
    await pinch(cdp, { x: band.x + band.width / 2, y: band.y + band.height / 2 }, 20, 100);
    await expect
      .poll(() => page.evaluate(() => window.visualViewport?.scale ?? 1))
      .toBeGreaterThan(1.5);
    expect(await zoomed(page)).toBe(zoom);
  });
});
