// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// Learn's written lessons, one test per interaction, against the built site
// with linlog's real module: the worked proof played with a prediction and a
// reason per step, the dead end, the self-explanation prompt, the faded proof,
// the hinge question, the attempt whose wrong step the visitor finds, a
// problem asked of linlog, a search that gives up at a small budget, the nets
// a lesson draws, and the hover explanations and schemas Learn adds.

import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { goto, rule, start } from "./prover";

async function lesson(page: Page, n: number, name: string) {
  await goto(page);
  await page.locator("footer").getByRole("button", { name: "Learn" }).click();
  await page.getByRole("button", { name: `Lesson ${n}: ${name}` }).click();
  return page.getByRole("complementary", { name: "Learn" });
}

test("a worked proof plays one inference at a time: the rule predicted, then its reason beside it", async ({
  page,
}) => {
  const frame = await lesson(page, 2, "The multiplicatives");
  await frame.getByRole("button", { name: "Start the worked proof" }).click();
  await expect(page.getByRole("button", { name: /^A⊥ ⅋ B⊥, formula 1 of goal 1/ })).toBeVisible();
  await expect(frame.getByText("Step 1 of 4: predict the next rule.")).toBeVisible();
  await frame.getByRole("button", { name: "Predict ⊗" }).click();
  await expect(frame.getByRole("status")).toContainText("The step is ⅋, not ⊗");
  const why = page.getByRole("note", { name: "Why this step" });
  await expect(why).toContainText("⅋: ⅋ puts A⊥ and B⊥ side by side");
  // Beside the rule label of the inference it explains, on the stage.
  const [box, stage] = [await why.boundingBox(), await page.locator(".stage").boundingBox()];
  expect(box && stage && box.x >= stage.x && box.x + box.width <= stage.x + stage.width).toBe(true);
  await expect(page.getByRole("button", { name: /^B ⊗ A, formula 3 of goal 2/ })).toBeVisible();
  await frame.getByRole("button", { name: "Predict ⊗" }).click();
  await expect(frame.getByRole("status")).toContainText("Right");
  for (const _ of [3, 4]) await frame.getByRole("button", { name: "Show the step" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Proved: every goal is closed" }),
  ).toBeVisible();
  await expect(frame.getByText("Proved", { exact: true })).toBeVisible();
});

test("the dead end is a legal split played on the stage, which cannot close, then taken back", async ({
  page,
}) => {
  const frame = await lesson(page, 2, "The multiplicatives");
  await frame.getByRole("button", { name: "Start the worked proof" }).click();
  await frame.getByRole("button", { name: "Show the step" }).click();
  await frame.getByRole("button", { name: "Play this split" }).click();
  await expect(frame.locator(".detour").getByRole("status")).toContainText("Cannot close");
  // Its premises are drawn: A⊥ went with B, B⊥ with A.
  await expect(page.getByRole("button", { name: /^A⊥, formula 1 of goal 3/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^B⊥, formula 1 of goal 4/ })).toBeVisible();
  // The next step takes it back and plays the right split.
  await frame.getByRole("button", { name: "Predict ⊗" }).click();
  await expect(frame.locator(".said")).toContainText("Right");
  await expect(page.getByRole("button", { name: /^B⊥, formula 1 of goal 3/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^A⊥, formula 1 of goal 4/ })).toBeVisible();
});

test("the self-explanation prompt follows its step, and a model answer comes on request", async ({
  page,
}) => {
  const frame = await lesson(page, 1, "Reading a sequent");
  await frame.getByRole("button", { name: "Start the worked proof" }).click();
  await expect(frame.getByLabel(/Explain it to yourself/)).toHaveCount(0);
  await frame.getByRole("button", { name: "Predict ax" }).click();
  const box = frame.getByLabel(/Explain it to yourself/);
  await box.fill("A⊥ is the hypothesis A.");
  await frame.getByRole("button", { name: "Compare with a model answer" }).click();
  await expect(frame.locator(".model")).toContainText("the axiom passes the hypothesis on");
});

test("the faded proof leaves the lesson's last steps to the visitor, and says when they finish it", async ({
  page,
}) => {
  const frame = await lesson(page, 2, "The multiplicatives");
  await frame.getByRole("button", { name: "Finish the proof yourself" }).click();
  // The page played ⅋; the split is the visitor's, with nothing on the redo stack.
  await expect(page.getByRole("button", { name: /^B ⊗ A, formula 3 of goal 2/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeDisabled();
  await rule(page, /^B ⊗ A, formula/, "⊗");
  await page.getByRole("button", { name: /^B⊥, formula/ }).click();
  await page.getByRole("dialog", { name: "Split" }).getByRole("button", { name: "Apply" }).click();
  await rule(page, /^B⊥, formula/, "ax");
  await rule(page, /^A⊥, formula/, "ax");
  const yours = frame.getByRole("region", { name: "Your turn" });
  await expect(yours.getByRole("status")).toContainText("Proved");
});

test("the hinge question names a wrong answer's misconception and offers the faded proof, the right one the next lesson", async ({
  page,
}) => {
  const frame = await lesson(page, 1, "Reading a sequent");
  const check = frame.getByRole("region", { name: "Check" });
  await check.getByRole("radio", { name: "⊢ A, A" }).check();
  await expect(check.getByRole("status")).toContainText(
    "This answer comes from the idea that the axiom pairs a formula with itself.",
  );
  await check.getByRole("button", { name: "Try the faded proof again" }).click();
  await expect(page.getByRole("button", { name: /^A⊥, formula 1 of goal 1/ })).toBeVisible();
  await check.getByRole("radio", { name: "⊢ A⊥, A", exact: true }).check();
  await check.getByRole("button", { name: "Next lesson: The multiplicatives" }).click();
  await expect(frame.getByRole("heading", { name: "The multiplicatives" })).toBeVisible();
});

test("with Learn on, a rule of the popover shows its schema and a formula its reading; off, neither", async ({
  page,
}) => {
  await start(page, "A * B |- B * A");
  await page.getByRole("button", { name: /^B ⊗ A, formula/ }).hover();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.locator("footer").getByRole("button", { name: "Learn" }).click();
  await page.getByRole("button", { name: /^B ⊗ A, formula/ }).hover();
  await expect(page.getByRole("tooltip")).toHaveText("⊗, tensor: both, side by side");
  await page.getByRole("button", { name: /^B ⊗ A, formula/ }).click();
  await page.getByRole("dialog", { name: "Rules" }).getByRole("button", { name: /^⊗/ }).hover();
  const tip = page.getByRole("tooltip");
  await expect(
    tip.getByRole("img", { name: "⊗: from ⊢ Γ, A and ⊢ Δ, B to ⊢ Γ, Δ, A ⊗ B" }),
  ).toBeVisible();
  await expect(tip).toContainText("Splits the goal");
});

test("the reference draws every rule of the lessons as a schema, with its two-sided names", async ({
  page,
}) => {
  await goto(page);
  await page.locator("footer").getByRole("button", { name: "Learn" }).click();
  const frame = page.getByRole("complementary", { name: "Learn" });
  await frame.getByRole("tab", { name: "Reference" }).click();
  const [one, two] = [frame.locator(".rule-list").nth(0), frame.locator(".rule-list").nth(1)];
  await expect(one.locator("> li")).toHaveCount(13);
  const promotion = frame.locator("#rule-promotion");
  await expect(promotion.getByRole("img", { name: "!: from ⊢ ?Γ, A to ⊢ ?Γ, !A" })).toBeVisible();
  await expect(promotion).toContainText("!R, ?L");
  // And the two-sided rules of intuitionistic linear logic, each with its one-sided rule.
  await expect(two.locator("> li")).toHaveCount(19);
  const implication = frame.locator("#rule-ill-lollipop-l");
  await expect(
    implication.getByRole("img", { name: "⊸L: from Γ ⊢ A and Δ, B ⊢ C to Γ, Δ, A ⊸ B ⊢ C" }),
  ).toBeVisible();
  await expect(implication).toContainText("One-sided: ⊗.");
});

test("in an intuitionistic proof, a rule of the popover shows its two-sided schema", async ({
  page,
}) => {
  const frame = await lesson(page, 6, "Two sides");
  await frame.getByRole("button", { name: "Start the worked proof" }).click();
  await frame.getByRole("button", { name: "Show the step" }).click();
  await page.getByRole("button", { name: /^A ⊸ B, formula/ }).click();
  await page.getByRole("dialog", { name: "Rules" }).getByRole("button", { name: /^⊸L/ }).hover();
  const tip = page.getByRole("tooltip");
  await expect(
    tip.getByRole("img", { name: "⊸L: from Γ ⊢ A and Δ, B ⊢ C to Γ, Δ, A ⊸ B ⊢ C" }),
  ).toBeVisible();
  await expect(tip).toContainText("The split is ⊗'s");
});

test("the attempt plays its steps, the visitor finds the wrong one, and linlog answers on the goal it left", async ({
  page,
}) => {
  const frame = await lesson(page, 7, "When there is no proof");
  const attempt = frame.getByRole("region", { name: "An attempt that went wrong" });
  await attempt.getByRole("button", { name: "Play the attempt" }).click();
  for (let step = 0; step < 5; step++)
    await attempt.getByRole("button", { name: "Next step of the attempt" }).click();
  // Stuck: ⊢ A⊥, B is open, the last step's reason beside it.
  await expect(page.getByRole("button", { name: /^A⊥, formula 1 of goal 6/ })).toBeVisible();
  await expect(page.getByRole("note", { name: "Why this step" })).toContainText("B ⊕ D gives B");
  await attempt.getByRole("radio", { name: "Step 5, ⊕₁" }).check();
  await expect(attempt.getByRole("status")).toContainText(
    "This answer comes from the idea that the wrong step is the one where the attempt got stuck.",
  );
  await attempt.getByRole("radio", { name: "Step 2, ⊕₁" }).check();
  await expect(attempt.getByRole("status")).toContainText("Right");
  await attempt.getByRole("button", { name: "Ask linlog about the goal step 2 left" }).click();
  await expect(page.locator(".dock .kw.bad")).toHaveText("Unprovable, checked: atom balance");
  // The worked proof takes the tab back and plays the right step.
  await frame.getByRole("button", { name: "Start the worked proof" }).click();
  await frame.getByRole("button", { name: "Show the step" }).click();
  await frame.getByRole("button", { name: "Predict ⊕₂" }).click();
  await expect(frame.locator(".said")).toContainText("Right");
  await expect(page.getByRole("button", { name: /^B⊥, formula 1 of goal 3/ })).toBeVisible();
});

test("a problem asked of linlog opens with its verdict and reason beside it", async ({ page }) => {
  const frame = await lesson(page, 7, "When there is no proof");
  await frame.getByRole("button", { name: "Ask linlog about A false case" }).click();
  await expect(page.locator(".dock .kw.bad")).toHaveText(
    "Unprovable, checked: a classical countermodel",
  );
});

test("a search with a small budget answers unknown, and twice the budget, three times, decides it", async ({
  page,
}) => {
  const frame = await lesson(page, 7, "When there is no proof");
  await frame.getByRole("button", { name: "Search it with a budget of 20 units" }).click();
  await expect(page.locator(".dock .kw.warn")).toHaveText("Unknown: gave up");
  for (const units of [40, 80, 160])
    await page.getByRole("button", { name: `Try ${units} units` }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Proved: every goal is closed" }),
  ).toBeVisible();
});

test("a lesson's finished proof shows its net, and its gallery draws nets with boxes", async ({
  page,
}) => {
  const frame = await lesson(page, 8, "Proof nets");
  await frame.getByRole("button", { name: "Start the worked proof" }).click();
  for (let step = 0; step < 7; step++)
    await frame.getByRole("button", { name: "Show the step" }).click();
  await frame.getByRole("button", { name: "See its net" }).click();
  await expect(page.getByRole("tab", { name: "Net" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".drawing svg desc")).toContainText("proof net");
  await frame.getByRole("button", { name: "Draw the net of Of course twice" }).click();
  await expect(page.locator(".drawing svg desc")).toContainText("proof net");
  // A box inside a box.
  await expect(page.locator('.drawing svg path[id^="b"]')).toHaveCount(2);
});
