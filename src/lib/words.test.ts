// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

import { describe, expect, it } from "vitest";
import { MODES } from "./linlog";
import { displayed, modeWords, pretty, SHORT, short, verdict } from "./words";
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
