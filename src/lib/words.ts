// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The page's words for what the library answers. The library gives facts
 * (an error's code and details, a refutation's kind and numbers, a search's
 * reason to stop); the page says them in its own plain sentences: a keyword
 * that stays in view, and a sentence one gesture away (a hover, a focus).
 */

import type { Failure, GoalFormula, Outcome, StepForm } from "./linlog";

/** A short keyword and the sentence behind it. */
export interface Said {
  readonly keyword: string;
  readonly sentence: string;
}

/** What a tone of colour a fact takes: refused or unprovable, unknown, checked, or plain. */
export type Tone = "bad" | "warn" | "ok" | "plain";

const formula = (formulas: readonly GoalFormula[], position: unknown) =>
  typeof position === "number"
    ? formulaText(formulas[position]?.text ?? `formula ${position + 1}`)
    : "a formula";

/** A step's refusal, with the goal's formulas to name. */
export function refusal(failed: Failure, formulas: readonly GoalFormula[], rule: string): Said {
  const details = failed.details ?? {};
  const at = formula(formulas, details["position"]);
  switch (details.kind) {
    case "not_alone":
      return {
        keyword: `${rule} refused: not alone`,
        sentence: `${rule} needs ${at} alone in the goal${rule === "ax" ? " with its dual" : ""}; other formulas are still there.`,
      };
    case "no_dual":
      return {
        keyword: `${rule} refused: no dual partner`,
        sentence: `ax needs ${at} and its dual alone in the goal, and the other formula is not its dual.`,
      };
    case "not_quest":
      return {
        keyword: `${rule} refused: ${at} is not a ? formula`,
        sentence: `Promotion needs every other formula of the goal under ?, and ${at} is not.`,
      };
    case "mode":
      return {
        keyword: `${rule} refused: not in this calculus`,
        sentence: `${rule} is not a rule of this calculus: weakening a formula that is not under ? needs affine weakening, and Mix needs Mix.`,
      };
    case "succedents":
      return {
        keyword: `${rule} refused: ${String(details["count"])} formulas right of ⊢`,
        sentence: `In intuitionistic logic a premise has one formula right of ⊢; this split would leave ${String(details["count"])}.`,
      };
    case "output":
      return {
        keyword: `${rule} refused: right of ⊢`,
        sentence: `In intuitionistic logic the formula right of ⊢ cannot be weakened.`,
      };
    case "empty_premise":
      return {
        keyword: `${rule} refused: an empty premise`,
        sentence:
          "This split leaves a premise with no formula, and no rule closes the empty sequent.",
      };
    case "rule":
      return {
        keyword: `${rule} refused: another connective`,
        sentence: `${rule} does not act on ${at}.`,
      };
    default:
      return { keyword: `${rule} refused`, sentence: failed.message };
  }
}

/** Why the sequent field's text is not a sequent the page can start. */
export function inputProblem(failed: Failure): Said {
  const details = failed.details ?? {};
  if (failed.code === "parse") {
    const found = details["found"];
    const expected = Array.isArray(details["expected"]) ? (details["expected"] as string[]) : [];
    const column = details["column"];
    return {
      keyword:
        typeof found === "string"
          ? `Unexpected ${found} at column ${String(column)}`
          : `Expected ${expected.join(" or ") || "more"}`,
      sentence: failed.message.replace(
        /^cannot parse the sequent: /,
        "The sequent does not parse: ",
      ),
    };
  }
  if (failed.code === "not_intuitionistic") {
    return {
      keyword: `${String(details["count"])} formulas right of ⊢`,
      sentence:
        "An intuitionistic sequent has exactly one formula right of ⊢: write the hypotheses left of it.",
    };
  }
  if (failed.code === "unsupported_version") {
    return {
      keyword: `Level ${String(details["found"])} unknown`,
      sentence: `This was written by a newer linlog (wire level ${String(details["found"])}); this page reads levels up to ${String(details["supported"])}. Export it from that version as a sequent instead.`,
    };
  }
  return { keyword: "Not read", sentence: failed.message };
}

const atom = (outcome: Outcome, index: unknown) => {
  const atoms = (outcome["sequent"] as { atoms?: string[] } | undefined)?.atoms ?? [];
  return typeof index === "number" ? (atoms[index] ?? `atom ${index + 1}`) : "an atom";
};

/** A search's verdict, as the status light and a goal's note say it. */
export function verdict(outcome: Outcome, checked: boolean | null): Said & { tone: Tone } {
  if (outcome.verdict === "proved") {
    return {
      keyword: outcome.checked ? "Proved, checked" : "Proved",
      sentence: `The search found a proof${outcome.checked ? ", and linlog's checker accepted it" : ""}.`,
      tone: outcome.checked ? "ok" : "plain",
    };
  }
  if (outcome.verdict === "unprovable") {
    const r = outcome.refutation ?? { kind: "exhausted" };
    const mark = checked ? ", checked" : "";
    const reasons: Record<string, Said> = {
      unbalanced: {
        keyword: `Unprovable${mark}: atom balance`,
        sentence: `${atom(outcome, r["atom"])} and its dual do not pair off: every derivation pairs each atom with its dual, and here ${atom(outcome, r["atom"])} is ahead by ${String(r["least"])}${r["least"] === r["most"] ? "" : ` to ${String(r["most"])}`}.`,
      },
      one_sided: {
        keyword: `Unprovable${mark}: atom balance`,
        sentence: `${atom(outcome, r["atom"])} cannot be paired off with its dual, however the formulas under ! and ? are copied.`,
      },
      equation: {
        keyword: `Unprovable${mark}: the count equation`,
        sentence:
          "The numbers of ⊗, ⅋, 1 and ⊥ do not add up: every proof of a multiplicative sequent satisfies one equation between them, and this sequent does not.",
      },
      state_equation: {
        keyword: `Unprovable${mark}: the state equation`,
        sentence:
          "No weighting of the clauses balances the atoms, which every derivation of this program would need.",
      },
      classical: {
        keyword: `Unprovable${mark}: a classical countermodel`,
        sentence: `Read classically the sequent is false when ${(Array.isArray(r["assignment"]) ? (r["assignment"] as boolean[]) : []).map((v, i) => `${atom(outcome, i)} is ${v ? "true" : "false"}`).join(", ")}; every provable sequent of linear logic is classically true.`,
      },
      exhausted: {
        keyword: "Unprovable: search exhausted",
        sentence:
          "The search tried every way and found no proof; there is no certificate to check.",
      },
    };
    return { ...(reasons[r.kind] ?? (reasons["exhausted"] as Said)), tone: "bad" };
  }
  const reason = outcome["reason"] as
    | { kind?: string; limit?: number; copies?: number; depth?: number }
    | undefined;
  const why: Record<string, string> = {
    work_limit: `it used its whole budget of ${String(reason?.limit)} units of work`,
    copy_bound: `every level up to ${String(reason?.copies)} copies of the ! formulas hit the bound`,
    recursion_limit: `it reached the depth of ${String(reason?.depth)} a tab allows`,
    memory_limit: "it reached the memory a tab allows",
    stopped: "it was stopped",
  };
  return {
    keyword: "Unknown: gave up",
    sentence: `The search gave up because ${why[reason?.kind ?? ""] ?? "it reached a bound"}${outcome.engine ? ` (engine ${outcome.engine})` : ""}. That says nothing about provability.`,
    tone: "warn",
  };
}

/** The connective's kind a rule is for, the hint ladder's first rung. */
export function ruleKind(rule: string): string {
  if (["⅋", "&", "⊥", "⊤", "⊸R", "&R", "⊥L", "⊤R", "1L", "⊗L", "⊕L", "!L"].includes(rule)) {
    return "an invertible rule";
  }
  if (["⊗", "mix", "⊗R", "⊸L"].includes(rule)) return "a split of the context";
  if (rule.startsWith("⊕") || rule.startsWith("&L")) return "a choice of one side";
  if (rule === "ax") return "the axiom";
  if (["1", "1R"].includes(rule)) return "the unit 1";
  if (rule.startsWith("?") || rule.startsWith("!")) return "an exponential rule";
  return `the rule ${rule}`;
}

/** The hint ladder's four rungs for a goal, from the steps the search proposes. */
export function rungs(steps: readonly StepForm[], formulas: readonly GoalFormula[]): string[] {
  const last = steps.at(-1);
  const first = steps[0];
  if (!last || !first) return [];
  const at = formula(formulas, first.position);
  const left = (first.left ?? []).map((p) => formula(formulas, p));
  return [
    `Work on this goal: ${ruleKind(last.rule)} comes next.`,
    `Look at ${at}.`,
    steps.length > 1
      ? `Apply ${steps.map((s) => s.rule).join(", then ")}, starting on ${at}.`
      : `Apply ${first.rule} to ${at}${left.length ? `, with ${left.join(", ")} going left` : first.left ? ", with nothing else going left" : ""}.`,
    "Applied. Why was this the step to take?",
  ];
}

/**
 * A typed sequent with the ASCII connectives as their signs, for the tab:
 * `|-` ⊢, `-o` ⊸, `*` ⊗, `|` ⅋, `+` ⊕; the parser reads both spellings.
 */
export function pretty(input: string): string {
  return input
    .replaceAll("|-", "⊢")
    .replaceAll("-o", "⊸")
    .replaceAll("*", "⊗")
    .replaceAll("|", "⅋")
    .replaceAll("+", "⊕");
}

/**
 * A typed sequent as the tab shows it, in Euler Math: `pretty`'s signs, the
 * units and `par` as theirs, and a negation, `~A` or `A^`, as `A⊥`, the dual
 * of a group or of an exponential formula parenthesised (`(A ⊗ B)⊥`,
 * `(!A)⊥`). For the eye only: linlog's parser does not read `A⊥`.
 */
export function displayed(input: string): string {
  let text = pretty(input)
    .replace(/\bpar\b/g, "⅋")
    .replace(/\bbot\b/g, "⊥")
    .replace(/\btop\b/g, "⊤")
    .replace(/\^/g, "⊥");
  // Each `~`, the last first, so that its operand is already shown.
  for (let at = text.lastIndexOf("~"); at >= 0; at = text.lastIndexOf("~", at - 1)) {
    const rest = text.slice(at + 1);
    const prefix = /^\s*[!?]*\s*/.exec(rest)?.[0] ?? "";
    let end = prefix.length;
    if (rest[end] === "(") {
      let depth = 0;
      for (; end < rest.length; end++) {
        if (rest[end] === "(") depth++;
        else if (rest[end] === ")" && --depth === 0) break;
      }
      end++;
    } else end += /^[A-Za-z0-9_']*/.exec(rest.slice(end))?.[0].length ?? 0;
    end += /^⊥*/.exec(rest.slice(end))?.[0].length ?? 0;
    const operand = rest.slice(0, end).trim();
    if (!operand) continue;
    const shown = /^[!?]/.test(operand) ? `(${operand})⊥` : `${operand}⊥`;
    text = text.slice(0, at) + shown + rest.slice(end);
    if (at === 0) break;
  }
  return text;
}

/** A formula as the library writes it, with each negated atom as `A⊥`, as the drawing sets it. */
export function formulaText(text: string): string {
  return text.replace(/~([A-Za-z0-9_']+)/g, "$1⊥");
}
