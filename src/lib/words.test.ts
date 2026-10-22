// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

import { describe, expect, it } from "vitest";
import { displayed, pretty, verdict } from "./words";
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
