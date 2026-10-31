// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

import { describe, expect, it } from "vitest";
import { MODES } from "./linlog";
import { displayed, modeWords, pretty, readingOf, rungs, SHORT, short, verdict } from "./words";
import { linlog } from "./testing";

describe("the typed sequent's signs", () => {
  it("read as the same sequent as the ASCII the visitor typed", () => {
    const typed = [
      "A * B |- B * A",
      "|- (~A | A) & (~B | B)",
      "A -o B, A |- B",
      "!A |- ?A + (A * 1)",
      "|- bot, top, 0, A",
      "A&B|-B+A",
    ];
    for (const text of typed) {
      const ascii = JSON.parse(linlog.read(text, "")).sequent;
      expect(JSON.parse(linlog.read(pretty(text), "")).sequent, text).toEqual(ascii);
    }
  });
});

describe("the tab's sequent", () => {
  it("shows negations as duals and every connective by its sign", () => {
    expect(displayed("a^ par b |- b * a")).toBe("a⊥ ⅋ b ⊢ b ⊗ a");
    expect(displayed("|- ~A | A, bot, top")).toBe("⊢ A⊥ ⅋ A, ⊥, ⊤");
    expect(displayed("~(A * ~B) |- ~~C, ~!D")).toBe("(A ⊗ B⊥)⊥ ⊢ C⊥⊥, (!D)⊥");
    expect(displayed("A, A -o B |- B")).toBe("A, A ⊸ B ⊢ B");
    expect(displayed("exists y. forall x. r(x, y) |- forall x. exists y. r(x, y)")).toBe(
      "∃y. ∀x. r(x, y) ⊢ ∀x. ∃y. r(x, y)",
    );
  });
});

describe("a verdict", () => {
  it("names a saturation refutation, checked, as the other checked refutations", () => {
    const answer = JSON.parse(
      linlog.prove("!(a -o a * a * a), !(a -o a), a |- a * (a + 0)", "intuitionistic", ""),
    );
    expect(answer.outcome.refutation.kind).toBe("saturated");
    expect(answer.outcome.version).toBe(3);
    expect(verdict(answer.outcome, answer.refutation_checked)).toMatchObject({
      keyword: "Unprovable, checked: saturation",
      tone: "bad",
    });
  });
});

describe("a mode's words", () => {
  it("are the switches' labels, not linlog's names", () => {
    expect(MODES.map(modeWords)).toEqual([
      "Classical",
      "Classical, affine",
      "Classical, Mix",
      "Classical, Mix, affine",
      "Intuitionistic",
      "Intuitionistic, affine",
    ]);
  });
});

describe("a tab's sequent, shortened to name the tab", () => {
  it("is kept whole when short, and cut with an ellipsis at SHORT characters", () => {
    expect(short("⊢ A⊥, B⊥, B ⊗ A")).toBe("⊢ A⊥, B⊥, B ⊗ A");
    const long = displayed("!(a -o a * a * a), !(a -o a), a |- a * (a + 0)");
    const cut = short(long);
    expect(Array.from(cut).length).toBeLessThanOrEqual(SHORT);
    expect(cut.endsWith("…")).toBe(true);
    expect(long.startsWith(cut.slice(0, -1))).toBe(true);
  });
});

describe("the hint ladder's first rung", () => {
  const formulas = [{ text: "A ⊗ ~B", occurrence: 0, side: null }];
  const tensor = [{ position: 0, rule: "⊗", left: [] }];
  it("names an invertible rule as linlog judges it, and a dereliction as no such rule", () => {
    expect(rungs([{ position: 0, rule: "⅋" }], formulas, true, false)[0]).toBe(
      "Work on this goal: an invertible rule comes next.",
    );
    expect(rungs([{ position: 0, rule: "!L" }], formulas, false, false)[0]).toBe(
      "Work on this goal: an exponential rule comes next.",
    );
  });
  it("takes whether a rule is invertible from linlog: not a dereliction, but \\R", () => {
    const hinted = (text: string, mode: string) => {
      const read = JSON.parse(linlog.read(text, ""));
      const start = JSON.parse(linlog.start(JSON.stringify(read.sequent), mode, ""));
      const goal = start.view.goals[0].goal as number;
      const hint = JSON.parse(linlog.hint(JSON.stringify(start.session), goal, ""));
      const formulas = start.view.goals[0].formulas;
      return [hint.steps.at(-1).rule, rungs(hint.steps, formulas, hint.invertible, false)[0]];
    };
    expect(hinted("!A |- A", "intuitionistic")).toEqual([
      "!L",
      "Work on this goal: an exponential rule comes next.",
    ]);
    // A \\ A, one-sided ~A ⅋ A; the page's reader is commutative, and one formula has one order.
    expect(hinted("|- ~A par A", "lambek-star")).toEqual([
      "\\R",
      "Work on this goal: an invertible rule comes next.",
    ]);
  });
  it("says that the invertible rules are done when the page applies them", () => {
    expect(rungs(tensor, formulas, false, true)[0]).toBe(
      "The invertible rules are applied already; on this goal a split of the context comes next.",
    );
    expect(rungs(tensor, formulas, false, false)[0]).toBe(
      "Work on this goal: a split of the context comes next.",
    );
  });
});

describe("a formula's reading, for its hover with Learn on", () => {
  it("names the connective it is built by last, or what its literal is", () => {
    expect(readingOf("(A ⊗ B) ⊕ (A ⊗ C)")).toBe("⊕, plus: one of them, the prover's choice");
    expect(readingOf("A⊥ ⅋ (B⊥ & C⊥)")).toBe("⅋, par: the dual of tensor");
    expect(readingOf("?A⊥")).toBe("?, why not: the dual of of course");
    expect(readingOf("⊤")).toBe("⊤, top: the unit of &");
    expect(readingOf("B⊥")).toBe("The dual of the atom B");
    expect(readingOf("A")).toBe("The atom A");
    expect(readingOf("∀x. (p(x) ⊸ q(x))")).toBe("∀, for all: A for every x; the dual of exists");
    expect(readingOf("(∀x. p(x)) ⊸ ∀x. q(x)")).toBe(
      "⊸, linear implication: consumes A, gives B; A⊥ ⅋ B",
    );
    expect(readingOf("∃y. (∀x. r(x, y))")).toBe("∃, exists: A for some x, a witness chosen");
    expect(readingOf("r(a, b)")).toBe("The atom r(a, b)");
  });
});
