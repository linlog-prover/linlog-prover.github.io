// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// One test per interaction of the island, against the built site with
// linlog's real module in its worker.

import { readFile } from "node:fs/promises";
import { expect, test } from "./fixtures";
import { calculus, goto, proveCommuted, rule, start, switches } from "./prover";

test("the sequent field starts a proof, and marks where a sequent does not parse", async ({
  page,
}) => {
  await goto(page);
  await expect(page.getByRole("textbox", { name: "Sequent" })).toBeFocused();
  await page.getByRole("textbox", { name: "Sequent" }).fill("A * * B");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toContainText("Unexpected * at column 5");
  await expect(page.locator(".caret .at")).toHaveText("*");
  await page.getByRole("textbox", { name: "Sequent" }).fill("A * B |- B * A");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /^A⊥ ⅋ B⊥, formula 1 of goal 1/ })).toBeVisible();
  await expect(page.locator(".pt-mark")).toContainText("MLL");
});

test("a formula's popover lists only the rules linlog gives for it", async ({ page }) => {
  await start(page, "A * B |- B * A");
  await page.getByRole("button", { name: /^B ⊗ A, formula 2/ }).click();
  const rules = page.getByRole("dialog", { name: "Rules" }).getByRole("button");
  await expect(rules).toHaveCount(1);
  await expect(rules.first()).toContainText("⊗");
});

test("the split chooser sends formulas left and says whether the split can close", async ({
  page,
}) => {
  await start(page, "A * B |- B * A");
  await rule(page, /^A⊥ ⅋ B⊥/, "⅋");
  await rule(page, /^B ⊗ A/, "⊗");
  const split = page.getByRole("dialog", { name: "Split" });
  await page.getByRole("button", { name: /^A⊥, formula 1/ }).click();
  await expect(split.getByText("Cannot close")).toBeVisible();
  await page.getByRole("button", { name: /^A⊥, formula 1/ }).click();
  await page.getByRole("button", { name: /^B⊥, formula 2/ }).click();
  await expect(split.getByText("Passes")).toBeVisible();
  await split.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator(".dock .gn")).toHaveText("Goal 3 · 2 open");
});

test("a refused step says the library's reason at the goal", async ({ page }) => {
  await start(page, "|- A, B");
  await rule(page, /^A, formula 1/, "ax");
  const refusal = page.locator(".dock .kw.bad");
  await expect(refusal).toHaveText("ax refused: no dual partner");
  await expect(refusal).toHaveAttribute("data-tip", /and its dual alone in the goal/);
  await expect(page.locator("[aria-live]")).toContainText("ax refused");
});

test("undo takes back the last step on the active branch only, and redo puts it back", async ({
  page,
}) => {
  await start(page, "|- (~A | A) & (~B | B)");
  await rule(page, /^\(A⊥ ⅋ A\) & \(B⊥ ⅋ B\)/, "&");
  // The right premise first, then the left: the session's last step is on the left branch.
  await page.getByRole("button", { name: "Next goal" }).click();
  await rule(page, /^B⊥ ⅋ B, formula 1 of goal 3/, "⅋");
  await page.getByRole("button", { name: /^A⊥ ⅋ A, formula 1 of goal 2/ }).click();
  await page.getByRole("dialog", { name: "Rules" }).getByRole("button", { name: /⅋/ }).click();
  await expect(page.getByRole("button", { name: /^A⊥, formula 1 of goal 5/ })).toBeVisible();
  // Back to the right branch's goal and undo there: the left branch's later step stays.
  await page.getByRole("button", { name: /^B⊥, formula 1 of goal 4/ }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: /^B⊥ ⅋ B, formula 1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^A⊥, formula 1/ })).toBeVisible();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByRole("button", { name: /^B⊥, formula 1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^B⊥ ⅋ B, formula 1/ })).toHaveCount(0);
});

test("a goal's close grafts the search's proof, and close all closes the rest", async ({
  page,
}) => {
  await start(page, "A * B |- B * A");
  await page.getByRole("button", { name: "Close goal" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Proved: every goal is closed" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await rule(page, /^A⊥ ⅋ B⊥/, "⅋");
  await page.getByRole("button", { name: "Close all" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Proved: every goal is closed" }),
  ).toBeVisible();
  await expect(page.locator(".drawing g.search").first()).toBeAttached();
});

test("an unprovable goal's close says why, checked; a search that gives up offers twice the budget", async ({
  page,
}) => {
  await start(page, "A * B |- A");
  await page.getByRole("button", { name: "Close goal" }).click();
  await expect(page.locator(".dock .kw.bad")).toHaveText("Unprovable, checked: atom balance");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("spinbutton").fill("1");
  await page.getByRole("spinbutton").press("Enter");
  await page.keyboard.press("Escape");
  await start(page, "!A |- A * A", false);
  await page.getByRole("button", { name: "Close goal" }).click();
  await expect(page.locator(".dock .kw.warn")).toHaveText("Unknown: gave up");
  await expect(page.getByRole("button", { name: "Try 2 units" })).toBeVisible();
});

test("the hint ladder climbs four rungs, and the last applies the step", async ({ page }) => {
  await start(page, "A * B |- B * A");
  const hint = page.getByRole("button", { name: "Hint" });
  await hint.click();
  await expect(page.locator(".dock .hint")).toContainText("an invertible rule comes next");
  await hint.click();
  await expect(page.locator(".dock .hint")).toContainText("Look at A⊥ ⅋ B⊥");
  await expect(page.locator(".fb[data-hinted]")).toHaveCount(1);
  await hint.click();
  await expect(page.locator(".dock .hint")).toContainText("Apply ⅋ to A⊥ ⅋ B⊥");
  await hint.click();
  await expect(page.locator(".dock .hint")).toContainText("Why was this the step to take?");
  // The page applied ⅋: its formula is gone, its premise's are the goal, and it is a step.
  await expect(page.getByRole("button", { name: /^A⊥, formula 1 of goal 2/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^A⊥ ⅋ B⊥/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Steps" }).click();
  await expect(page.getByRole("dialog", { name: "Steps" }).getByRole("button")).toHaveText([
    /^0/,
    /^1⅋ on goal 1/,
  ]);
});

test("the finished MLL proof's net is drawn, and the net tab says why it is greyed elsewhere", async ({
  page,
}) => {
  await start(page, "!A |- A");
  await expect(page.getByRole("tab", { name: "Net" })).toHaveAttribute(
    "data-tip",
    /exist for MLL without units only/,
  );
  await start(page, "A * B |- B * A", false);
  await expect(page.getByRole("tab", { name: "Net" })).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("button", { name: "Close goal" }).click();
  await page.getByRole("tab", { name: "Net" }).click();
  await expect(page.getByRole("tab", { name: "Net" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".drawing svg desc")).toContainText("proof net");
});

test("every export downloads, and the link is copied", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await proveCommuted(page);
  const contents: [string, Buffer][] = [];
  const formats: [string, RegExp][] = [
    ["SVG", /\.svg$/],
    ["PNG", /\.png$/],
    ["PDF", /\.pdf$/],
    ["LaTeX", /\.tex$/],
    ["Typst", /\.typ$/],
    ["Text", /\.txt$/],
    ["Session", /\.json$/],
    ["Rocq", /\.v$/],
  ];
  for (const [label, name] of formats) {
    await page.getByRole("button", { name: "Export" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: new RegExp(`^${label}`) }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(name);
    const bytes = await readFile(await file.path());
    expect(bytes.length).toBeGreaterThan(20);
    contents.push([label, bytes]);
    await page.keyboard.press("Escape");
  }
  // Each file is what its format says: the drawing, the documents, the certificate.
  const text = (label: string) => contents.find(([l]) => l === label)?.[1].toString("utf8") ?? "";
  const head = (label: string) =>
    contents.find(([l]) => l === label)?.[1].subarray(0, 8) ?? Buffer.alloc(0);
  expect(text("SVG")).toContain("<svg");
  expect(head("PNG").subarray(1, 4).toString("latin1")).toBe("PNG");
  expect(head("PDF").subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(text("LaTeX")).toContain("\\begin{prooftree}");
  expect(text("Typst")).toContain("prooftree(");
  expect(text("Text")).toContain("⊢ ~A ⅋ ~B, B ⊗ A");
  expect(JSON.parse(text("Session")).history.length).toBe(1);
  expect(text("Rocq")).toMatch(/Lemma certificate[\s\S]*Qed\./);
  await page.getByRole("button", { name: "Export" }).click();
  await page.getByRole("menuitem", { name: /^Link/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Link copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("#v=1");
});

test("Settings sets the formulas' font: the drawing laid out in it, every formula in it, the font fetched when chosen, the exports following it until they choose their own", async ({
  page,
}) => {
  const fetched: string[] = [];
  page.on("request", (request) => fetched.push(new URL(request.url()).pathname));
  await proveCommuted(page);
  const drawn = () =>
    page
      .locator(".drawing svg text")
      .evaluateAll((all) => all.map((t) => t.getAttribute("textLength")));
  const euler = await drawn();
  expect(fetched.some((path) => path.startsWith("/fonts/STIXTwoMath-"))).toBe(false);
  await page.locator("footer").getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("radio", { name: "STIX Two Math" }).check();
  await page.keyboard.press("Escape");
  await expect(page.locator(".drawing svg")).toHaveAttribute("font-family", /'STIX Two Math'/);
  expect(await drawn()).not.toEqual(euler);
  expect(fetched.some((path) => path.startsWith("/fonts/STIXTwoMath-"))).toBe(true);
  await expect
    .poll(() => page.evaluate(() => document.fonts.check("30px 'STIX Two Math'")))
    .toBe(true);
  // The tab's sequent and every formula of the page follow.
  const family = await page
    .locator(".ptab .pt-go .m")
    .evaluate((element) => getComputedStyle(element).fontFamily);
  expect(family).toContain("STIX Two Math");
  // The exports follow the stage until they choose their own, which is kept apart.
  await page.getByRole("button", { name: "Export" }).click();
  await expect(page.getByRole("menuitemradio", { name: "STIX Two Math" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("menuitemradio", { name: "Euler Math" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".drawing svg")).toHaveAttribute("font-family", /'STIX Two Math'/);
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("linlog-settings") ?? "{}"),
  );
  expect([stored.stageFont, stored.font]).toEqual(["stix-two", "euler"]);
  await start(page, "A |- A");
  await expect(page.locator(".drawing svg")).toHaveAttribute("font-family", /'STIX Two Math'/);
});

test("the export menu chooses the font of the SVG, PNG and PDF, kept for the next visit, and the page's drawing stays in Euler Math", async ({
  page,
}) => {
  await proveCommuted(page);
  const exported = async (label: string) => {
    await page.getByRole("button", { name: "Export" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: new RegExp(`^${label}`) }).click();
    const bytes = await readFile(await (await download).path());
    await page.keyboard.press("Escape");
    return bytes;
  };
  const euler = {
    svg: await exported("SVG"),
    png: await exported("PNG"),
    pdf: await exported("PDF"),
  };
  expect(euler.svg.toString("utf8")).toContain("font-family=\"'Euler Math', 'Neo Euler', serif\"");
  expect(euler.pdf.toString("latin1")).toContain("Euler-Math");
  await page.getByRole("button", { name: "Export" }).click();
  const font = page.getByRole("menuitemradio", { name: "STIX Two Math" });
  await expect(page.getByRole("menuitemradio", { name: "Euler Math" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await font.click();
  await expect(font).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  const svg = (await exported("SVG")).toString("utf8");
  expect(svg).toContain("font-family=\"'STIX Two Math', serif\"");
  // Laid out in STIX Two Math's advances, not Euler Math's.
  expect(svg.match(/textLength="\d+"/g)).not.toEqual(
    euler.svg.toString("utf8").match(/textLength="\d+"/g),
  );
  expect((await exported("PNG")).equals(euler.png)).toBe(false);
  expect((await exported("PDF")).toString("latin1")).toContain("STIXTwoMath-Regular");
  // The page draws in Euler Math whatever the exports are set in.
  await expect(page.locator(".drawing svg")).toHaveAttribute("font-family", /'Euler Math'/);
  await start(page, "A |- A");
  await page.getByRole("button", { name: "Export" }).click();
  await expect(page.getByRole("menuitemradio", { name: "STIX Two Math" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("the certificate of non-derivability downloads for a refuted goal", async ({ page }) => {
  await start(page, "A |- B");
  await page.getByRole("button", { name: "Close goal" }).click();
  await page.getByRole("button", { name: "Export" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /^Not derivable/ }).click();
  const certificate = await readFile(await (await download).path(), "utf8");
  expect(certificate).toMatch(/Lemma certificate : ~ ll[\s\S]*Qed\./);
});

test("the link in the fragment restores the proof, or says it could not", async ({
  page,
  browser,
}) => {
  await start(page, "A * B |- B * A");
  await rule(page, /^A⊥ ⅋ B⊥/, "⅋");
  await expect(page).toHaveURL(/#v=1&m=classical&s=.*&d=/);
  const url = page.url();
  const fresh = await browser.newPage();
  await fresh.goto(url);
  await expect(fresh.getByRole("button", { name: /^A⊥, formula 1 of goal 2/ })).toBeVisible();
  // The proof the link opened is not offered again by the restore bar, on a reload either.
  await fresh.waitForTimeout(500);
  await fresh.reload();
  await expect(fresh.getByRole("button", { name: /^A⊥, formula 1 of goal 2/ })).toBeVisible();
  await expect(fresh.getByRole("region", { name: "Restore" })).toHaveCount(0);
  await expect(fresh.locator(".ptab")).toHaveCount(1);
  await fresh.goto(url.replace(/&d=[^&]*/, "&d=AAAA"));
  await fresh.reload();
  await expect(fresh.getByText("Proof not restored")).toBeVisible();
  await expect(fresh.getByRole("button", { name: /^A⊥ ⅋ B⊥, formula 1 of goal 1/ })).toBeVisible();
});

test("a link whose sequent does not parse shows the parse error under the field", async ({
  page,
}) => {
  await page.goto("/#v=1&m=classical&s=A+*+*+B");
  await expect(page.getByRole("textbox", { name: "Sequent" })).toHaveValue("A * * B");
  await expect(page.getByRole("alert")).toContainText("Unexpected * at column 5");
  await expect(page.locator(".caret .at")).toHaveText("*");
});

test("a link whose session unpacks past the cap loads the sequent alone and says why", async ({
  page,
}) => {
  // 4 MiB of one character, deflated: about four kilobytes of link.
  const hash = await page.evaluate(async () => {
    const text = JSON.stringify({ pad: "a".repeat(4 * 1024 * 1024) });
    const packed = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    const bytes = new Uint8Array(await new Response(packed).arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const d = btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
    return `#v=1&m=classical&s=A+|-+A&d=${d}`;
  });
  await page.goto(`/${hash}`);
  await page.reload();
  await expect(page.getByText("Proof not restored")).toBeVisible();
  await expect(page.getByText("Proof not restored")).toHaveAttribute(
    "data-tip",
    /more than a link may hold/,
  );
  await expect(page.getByRole("button", { name: /^A, formula/ })).toBeVisible();
});

test("a proof's tab shows its sequent in signs, in Euler Math", async ({ page }) => {
  await start(page, "a^ par b |- b * a");
  const tab = page.locator(".pt-go .m");
  await expect(tab).toHaveText("a⊥ ⅋ b ⊢ b ⊗ a");
  expect(await tab.evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/^"Euler Math"/);
  await expect
    .poll(() => page.evaluate(() => document.fonts.check('16px "Euler Math"', "⊗")))
    .toBe(true);
  await page.goto("/#v=1&m=intuitionistic&s=A,+A+-o+B+|-+B");
  await page.reload();
  await expect(page.locator(".ptab[aria-current] .pt-go .m")).toHaveText("A, A ⊸ B ⊢ B");
});

test("autosave keeps every open proof, and the restore bar brings them back", async ({ page }) => {
  await start(page, "A * B |- B * A");
  await rule(page, /^A⊥ ⅋ B⊥/, "⅋");
  await page.getByRole("button", { name: "New proof" }).click();
  await page.getByRole("textbox", { name: "Sequent" }).fill("A |- A");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /^A⊥, formula 1 of goal 1/ })).toBeVisible();
  await page.waitForTimeout(500);
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Restore" })).toContainText(
    "2 proofs from your last visit",
  );
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.locator(".ptab")).toHaveCount(2);
  await page.locator(".pt-go").first().click();
  await expect(page.getByRole("button", { name: /^A⊥, formula 1 of goal 2/ })).toBeVisible();
});

test("several proofs are open at once, each with its own state", async ({ page }) => {
  await start(page, "A * B |- B * A");
  await page.getByRole("button", { name: "New proof" }).click();
  await page.getByRole("textbox", { name: "Sequent" }).fill("A, B |- A * B");
  await page.keyboard.press("Enter");
  await page.locator(".pt-go").first().click();
  await expect(page.getByRole("button", { name: /^B ⊗ A, formula 2 of goal 1/ })).toBeVisible();
  await page.locator(".pt-go").nth(1).click();
  await expect(page.getByRole("button", { name: /^A ⊗ B, formula 3 of goal 1/ })).toBeVisible();
  await page.getByRole("button", { name: "Close this proof" }).nth(1).click();
  await expect(page.locator(".ptab")).toHaveCount(1);
});

test("import reads a session or a sequent, and refuses a level it does not know", async ({
  page,
}) => {
  await proveCommuted(page);
  await page.getByRole("button", { name: "Export" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /^Session/ }).click();
  const session = await readFile(await (await download).path(), "utf8");
  await page.getByRole("button", { name: "Import" }).click();
  const panel = page.getByRole("dialog", { name: "Import" });
  await panel.getByRole("textbox").fill(session);
  await panel.getByRole("button", { name: "Import", exact: true }).click();
  await expect(panel.getByRole("status")).toHaveText("Imported a session.");
  await expect(page.locator(".ptab")).toHaveCount(2);
  await panel.getByRole("textbox").fill('{"version":9,"terms":[],"roots":[],"atoms":[]}');
  await panel.getByRole("button", { name: "Import", exact: true }).click();
  await expect(panel.getByRole("status")).toContainText("Level 9 unknown: not imported");
  await panel.locator('input[type="file"]').setInputFiles({
    name: "sequent.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(JSON.parse(session).sequent)),
  });
  await expect(panel.getByRole("status")).toHaveText("Imported a sequent from sequent.json.");
});

test("a proof goes by keyboard alone", async ({ page }) => {
  await start(page, "A * B |- B * A");
  await page.getByRole("button", { name: /^A⊥ ⅋ B⊥, formula 1/ }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("1");
  await expect(page.getByRole("button", { name: /^A⊥, formula 1 of goal 2/ })).toBeFocused();
  await page.keyboard.press("u");
  await expect(page.getByRole("button", { name: /^A⊥ ⅋ B⊥, formula 1/ })).toBeVisible();
  await page.keyboard.press("Shift+U");
  await expect(page.getByRole("button", { name: /^A⊥, formula 1 of goal 2/ })).toBeVisible();
  await page.keyboard.press("Shift+C");
  await expect(
    page.getByRole("status").filter({ hasText: "Proved: every goal is closed" }),
  ).toBeVisible();
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Keys" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Keys" })).toHaveCount(0);
});

test("the calculus's switches restart the proof after a warning, and two-sided shows in classical mode alone", async ({
  page,
}) => {
  await start(page, "A, B |- A * B");
  // Classical derivations are drawn one-sided: the switch is there, greyed.
  await expect((await switches(page)).getByRole("checkbox", { name: "Two-sided" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await rule(page, /^A ⊗ B/, "⊗");
  await page.getByRole("button", { name: /^B⊥, formula 2/ }).click();
  await page.getByRole("dialog", { name: "Split" }).getByRole("button", { name: "Apply" }).click();
  await (await switches(page)).getByRole("button", { name: "Intuitionistic" }).click();
  await page.getByRole("button", { name: "Restart" }).click();
  await expect(page.locator(".pt-mark")).toContainText("ILL");
  await expect(page.getByRole("button", { name: /^A ⊗ B, formula 3 of goal 1/ })).toBeVisible();
  // Intuitionistic derivations are two-sided already: the switch is not shown.
  await expect((await switches(page)).getByRole("checkbox", { name: "Two-sided" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await start(page, "A |- B, C", false);
  await expect(page.getByRole("alert")).toContainText("2 formulas right of ⊢");
});

test("the light and dark toggle pins a scheme, kept on the next visit", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await goto(page);
  await page.getByRole("button", { name: "Light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const field = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(field);
  await page.getByRole("button", { name: "Dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("the step list goes back to a step, and redo brings the rest back", async ({ page }) => {
  await start(page, "A * B |- B * A");
  await rule(page, /^A⊥ ⅋ B⊥/, "⅋");
  await page.getByRole("button", { name: "Close goal" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Proved: every goal is closed" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Steps" }).click();
  const steps = page.getByRole("dialog", { name: "Steps" });
  await expect(steps.getByRole("button")).toHaveText([
    /^0/,
    /^1⅋ on goal 1/,
    /^2The focused search closed goal 2/,
  ]);
  await steps.getByRole("button", { name: /^0/ }).click();
  await expect(page.getByRole("button", { name: /^A⊥ ⅋ B⊥, formula 1 of goal 1/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Proved: every goal is closed" }),
  ).toBeVisible();
});

test("the fragment shows beside the calculus while the sequent is typed", async ({ page }) => {
  await goto(page);
  await page.getByRole("textbox", { name: "Sequent" }).fill("!A |- A * A");
  await expect(page.locator(".pt-mark .frag")).toHaveText("MELL");
  await page.getByRole("textbox", { name: "Sequent" }).fill("A & B |- A");
  await expect(page.locator(".pt-mark .frag")).toHaveText("ALL");
});

test("a finished intuitionistic proof's essential net is drawn", async ({ page }) => {
  await start(page, "A, B |- A * B");
  await calculus(page, ["Intuitionistic"]);
  await expect(page.locator(".pt-mark")).toContainText("ILL");
  await page.getByRole("button", { name: "Close goal" }).click();
  await page.getByRole("tab", { name: "Net" }).click();
  await expect(page.locator(".drawing svg desc")).toContainText("proof net");
});

test("Settings' net drawing writes every formula or draws the net compact, in the view and the export", async ({
  page,
}) => {
  await proveCommuted(page);
  await page.getByRole("tab", { name: "Net" }).click();
  // With its formulas every occurrence is written; compact, each of the two links is a circle.
  await expect(page.locator(".drawing svg desc")).toContainText("proof net");
  await expect(page.locator(".drawing svg circle")).toHaveCount(0);
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(
    page.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: "Formulas" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("dialog", { name: "Settings" })
    .getByRole("button", { name: "Compact" })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".drawing svg circle")).toHaveCount(2);
  await page.getByRole("button", { name: "Export" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /^SVG/ }).click();
  const svg = await readFile(await (await download).path(), "utf8");
  expect(svg).toContain("proof net");
  expect(svg.match(/<circle /g)?.length).toBe(2);
});

test("the essential net keeps its input side's colour in both themes", async ({ page }) => {
  await start(page, "A * B |- B * A");
  await calculus(page, ["Intuitionistic"]);
  await expect(page.locator(".pt-mark")).toContainText("ILL");
  await page.getByRole("button", { name: "Close goal" }).click();
  await page.getByRole("tab", { name: "Net" }).click();
  const input = page.locator('.drawing svg text[fill="#009e73"]').first();
  const edge = page.locator('.drawing svg g[stroke="#009e73"] path').first();
  // The hypothesis A ⊗ B, its edges and its literals, is the input side: --color-net-input, never the ink.
  for (const [colorScheme, colour] of [
    ["light", "rgb(0, 118, 90)"],
    ["dark", "rgb(63, 199, 156)"],
  ] as const) {
    await page.emulateMedia({ colorScheme });
    await expect(input).toHaveCSS("fill", colour);
    await expect(edge).toHaveCSS("stroke", colour);
  }
});

test("the net view fits the whole net, drawn afresh with each drawing", async ({ page }) => {
  await start(page, "A * B * C * D * E * F |- F * E * D * C * B * A");
  await page.getByRole("button", { name: "Close goal" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Proved: every goal is closed" }),
  ).toBeVisible();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Zoom in" }).click();
  const inside = async () => {
    const stage = await page.locator(".stage").boundingBox();
    const net = await page.locator(".drawing svg").boundingBox();
    if (!stage || !net) return false;
    return (
      net.x >= stage.x &&
      net.y >= stage.y &&
      net.x + net.width <= stage.x + stage.width &&
      net.y + net.height <= stage.y + stage.height
    );
  };
  await page.getByRole("tab", { name: "Net" }).click();
  await expect(page.locator(".drawing svg desc")).toContainText("proof net");
  await expect.poll(inside).toBe(true);
  await page.getByRole("button", { name: "Settings" }).click();
  await page
    .getByRole("dialog", { name: "Settings" })
    .getByRole("button", { name: "Compact" })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".drawing svg circle").first()).toBeVisible();
  await expect.poll(inside).toBe(true);
});

test("an action asked for while a search runs waits, and loses neither result", async ({
  page,
}) => {
  // A search of about half a second, which refutes the goal in the end.
  await start(page, "!(A & B) * !(A & B) |- !A * !B * !A * !B * ?C");
  await rule(page, /^\?\(A⊥ ⊕ B⊥\) ⅋ \?\(A⊥ ⊕ B⊥\)/, "⅋");
  await page.getByRole("button", { name: "Close goal" }).click();
  // Undo while the search runs: it does nothing, rather than replaying a session the search replaces.
  await page.keyboard.press("u");
  await expect(page.locator(".dock .kw.bad")).toContainText("Unprovable");
  await expect(page.getByRole("button", { name: /^\?\(A⊥ ⊕ B⊥\) ⅋/ })).toHaveCount(0);
  // Once it ended, undo takes back the ⅋.
  await page.locator("footer").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: /^\?\(A⊥ ⊕ B⊥\) ⅋ \?\(A⊥ ⊕ B⊥\)/ })).toBeVisible();
});

test("a goal opens in a new tab of its sequent, in the same calculus, which remembers where it came from", async ({
  page,
}) => {
  await start(page, "A * B |- B * A");
  await rule(page, /^A⊥ ⅋ B⊥/, "⅋");
  await page.getByRole("button", { name: "Open this goal in a new tab" }).click();
  await expect(page.locator(".ptab")).toHaveCount(2);
  await expect(page.locator(".ptab[aria-current=true] .pt-go .m")).toHaveText("⊢ A⊥, B⊥, B ⊗ A");
  await expect(page.locator(".ptab[aria-current=true] .pt-mark")).toContainText("LL");
  await expect(page.getByRole("button", { name: /^B ⊗ A, formula/ })).toBeVisible();
  const origin = await page.evaluate(() => {
    for (const key of Object.keys(localStorage).filter((k) => k.startsWith("linlog-proofs:"))) {
      const shelf = JSON.parse(localStorage.getItem(key) ?? "{}");
      const proof = shelf.proofs?.find((p: { origin?: unknown }) => p.origin);
      if (proof) return { origin: proof.origin, from: shelf.proofs[0].id };
    }
    return null;
  });
  expect(origin?.origin).toEqual({ from: origin?.from, path: [0] });
});

test("a goal is filled from another tab's finished proof as one step named with the tab, undone as one, and a proof of another calculus is refused at the goal", async ({
  page,
}) => {
  await start(page, "A * B |- B * A");
  await rule(page, /^A⊥ ⅋ B⊥/, "⅋");
  await expect(page.getByRole("button", { name: /^Fill from tab/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Open this goal in a new tab" }).click();
  await page.locator("footer").getByRole("button", { name: "Close all" }).click();
  await expect(page.getByText("Proved: every goal is closed")).toBeVisible();
  await page.locator(".ptab").first().locator(".pt-go").click();
  await page.getByRole("button", { name: "Fill from tab 2" }).click();
  await expect(page.getByText("Proved: every goal is closed")).toBeVisible();
  await expect(page.locator(".drawing svg text.engine")).toHaveText(["Proof from tab 2"]);
  await page.getByRole("button", { name: "Steps" }).click();
  await expect(page.getByRole("dialog", { name: "Steps" })).toContainText(
    "The proof from tab 2 closed goal",
  );
  await page.keyboard.press("Escape");
  await page.locator("footer").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: /^B ⊗ A, formula/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fill from tab 2" })).toBeVisible();

  // A proof under Mix, offered for the same formulas, is refused in classical logic.
  await start(page, "|- A, ~A, B, ~B", false);
  await start(page, "|- A, ~A, B, ~B", false);
  await calculus(page, ["Mix"]);
  await expect(page.locator(".ptab[aria-current=true] .pt-mark")).toContainText("LL+mix");
  await page.locator("footer").getByRole("button", { name: "Close all" }).click();
  await expect(page.getByText("Proved: every goal is closed")).toBeVisible();
  await page.locator(".ptab").nth(2).locator(".pt-go").click();
  await page.getByRole("button", { name: "Fill from tab 4" }).click();
  await expect(page.locator(".dline .kw.bad")).toHaveText(
    "Not filled: not a proof in this calculus",
  );
  await expect(page.getByRole("button", { name: /^A, formula/ })).toBeVisible();
});
