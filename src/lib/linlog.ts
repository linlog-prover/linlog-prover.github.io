// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The documents linlog's bindings take and give, as the page reads them.
 * Every call of the bindings takes JSON text and returns JSON text, an SVG
 * document or bytes; the shapes here are the parts of those documents the
 * page relies on (linlog's `plan/web/README.md`, "The bindings' API").
 */

/** The calculus a session is proved in, as the bindings name it. */
export type Mode =
  | "classical"
  | "affine"
  | "mix"
  | "affine-mix"
  | "intuitionistic"
  | "intuitionistic-affine";

/** Every mode, in the order the calculus's switches build them. */
export const MODES: readonly Mode[] = [
  "classical",
  "affine",
  "mix",
  "affine-mix",
  "intuitionistic",
  "intuitionistic-affine",
];

/** A math font linlog lays its drawings out in, by the name `styles.svg.font` takes. */
export type MathFont = "euler" | "stix-two" | "garamond" | "asana" | "new-computer-modern";

/**
 * linlog's math fonts, Euler Math (the page's default) first, each with its name, its look and
 * the family its file names, under which the page loads it and linlog's drawing asks for it.
 */
export const MATH_FONTS: readonly { key: MathFont; name: string; look: string; family: string }[] =
  [
    { key: "euler", name: "Euler Math", look: "Upright, as handwritten", family: "Euler Math" },
    {
      key: "stix-two",
      name: "STIX Two Math",
      look: "In the style of Times",
      family: "STIX Two Math",
    },
    {
      key: "garamond",
      name: "Garamond-Math",
      look: "In the style of Garamond",
      family: "Garamond-Math",
    },
    { key: "asana", name: "Asana Math", look: "In the style of Palatino", family: "Asana Math" },
    {
      key: "new-computer-modern",
      name: "New Computer Modern Math",
      look: "The Computer Modern of TeX",
      family: "NewComputerModernMath",
    },
  ];

/** A sequent's JSON, as `seq json` writes it: opaque to the page but its level. */
export interface SequentDoc {
  readonly version?: number;
  readonly [key: string]: unknown;
}

/** One inference of a session: a goal while it has no rule, expanded once it has. */
export interface Inference {
  /** The goal's formulas, as occurrences of the sequent's forest, in order. */
  readonly sequent: readonly number[];
  readonly rule?: string;
  /** The position in `sequent` of the formula the rule acts on. */
  readonly principal?: number;
  /** The premises' inferences, the left one first. */
  readonly premises?: readonly number[];
  /** For a cut, the occurrence of its cut formula, which the first premise holds. */
  readonly cut?: number;
}

/** A session: the library's session document, what `interact`'s `save` writes. */
export interface SessionDoc {
  readonly version: number;
  readonly sequent: SequentDoc;
  readonly mode: Mode;
  /** Every inference, the root first; a goal is the index of its inference. */
  readonly inferences: readonly Inference[];
  /** The goals expanded, in the order they were: by a step or by a search's graft. */
  readonly history: readonly number[];
}

/** A formula of an open goal, as the page shows it. */
export interface GoalFormula {
  readonly text: string;
  readonly occurrence: number;
  /** In intuitionistic mode, which side of `⊢` the formula is on. */
  readonly side: "input" | "output" | null;
  /** In intuitionistic mode, the formula as the reading writes it (a hypothesis `A ⊸ B`, whose `text` is `A ⊗ ~B`). */
  readonly reading?: string;
}

/** The library's error, as a call throws it. */
export interface Failure {
  readonly code: string;
  readonly kind: string;
  readonly message: string;
  readonly setting?: string | null;
  readonly details?: { readonly kind?: string; readonly [key: string]: unknown } | null;
}

/** What the page shows of a session. */
export interface View {
  readonly mode: Mode;
  readonly fragment: string;
  readonly complete: boolean;
  readonly steps: number;
  readonly goals: readonly { readonly goal: number; readonly formulas: readonly GoalFormula[] }[];
  /** `inferences[n]` is the inference the drawing's `i<n>` is. */
  readonly inferences: readonly number[];
  /** The inferences a step of an invertible rule closed, whoever took it, in order. */
  readonly invertible: readonly number[];
  /** Why the sequent has no proof net, or null when it has one. */
  readonly net: Failure | null;
  /** The session's cuts: each one's inference and its formula as typed, which a replay cuts with. */
  readonly cuts: readonly { readonly inference: number; readonly formula: string }[];
}

/** A rule a formula takes, and whether it splits the goal's context. */
export interface Offered {
  readonly rule: string;
  readonly split: boolean;
}

/** A step as `apply` takes it: the formula's position, the rule, and for a split the positions going left. */
export interface StepForm {
  readonly position: number;
  readonly rule: string;
  readonly left?: readonly number[];
}

/** A refutation's facts, as the library writes them. */
export interface Refutation {
  readonly kind: string;
  readonly [key: string]: unknown;
}

/** A search's outcome. */
export interface Outcome {
  readonly version: number;
  readonly verdict: "proved" | "unprovable" | "unknown";
  readonly checked?: boolean;
  readonly refutation?: Refutation;
  /** Why a search gave up, for an unknown verdict. */
  readonly reason?: { readonly kind: string; readonly [key: string]: unknown };
  readonly fragment?: string;
  readonly mode?: string;
  readonly engine?: string;
  readonly statistics?: { readonly work?: number; readonly [key: string]: unknown };
  readonly [key: string]: unknown;
}

/** A session with what the page shows of it, as `start`, `apply` and `undo` answer. */
export interface Played {
  readonly session: SessionDoc;
  readonly view: View;
}

/** What `read` makes of the page's input. */
export interface ReadResult {
  readonly kind: "sequent" | "session";
  readonly sequent: SequentDoc;
  readonly text: string;
  readonly fragment?: { readonly classical: string; readonly intuitionistic: string };
  readonly mode?: Mode;
  readonly session?: SessionDoc;
}

/** A goal's close: the session with the search's proof grafted, or what the search answered. */
export interface Closed extends Played {
  readonly outcome: Outcome;
  readonly refused: Failure | null;
  readonly refutation_checked: boolean | null;
}

/** The close of every goal within one budget. */
export interface ClosedAll extends Played {
  readonly results: readonly {
    readonly goal: number;
    readonly outcome?: Outcome | null;
    readonly refused?: Failure | null;
    readonly error?: Failure | null;
    readonly work?: number;
  }[];
}

/** The engines for a session's sequent: the one the dispatch picks, and whether each takes the sequent. */
export interface Engines {
  readonly automatic: string | null;
  readonly engines: readonly {
    readonly engine: string;
    /** linlog's refusal of a search forced to the engine, or null where it takes the sequent. */
    readonly refused: Failure | null;
  }[];
}

/** A hint: the search's outcome on the goal and the first steps of its proof. */
export interface Hint {
  readonly outcome: Outcome;
  readonly steps: readonly StepForm[] | null;
  /** Whether the last step applies a rule invertible in the session's mode; null without steps. */
  readonly invertible: boolean | null;
}

/** A call's answer after the invertible rules were applied by themselves: how many steps they took. */
export interface Inverted extends Played {
  readonly inverted: number;
  /** The bound that stopped them, if one did; the steps taken stand. */
  readonly inverted_refused?: Failure;
}

/**
 * The bindings' calls the step tree replays with, as linlog's module exports
 * them: synchronous, JSON text in and out, a failure thrown as its JSON.
 */
export interface Prover {
  start(sequent: string, mode: string, settings: string): string;
  apply(session: string, goal: number, step: string, settings: string): string;
  cut(session: string, goal: number, formula: string, left: string, settings: string): string;
  close(session: string, goal: number, settings: string): string;
  undo(session: string, settings: string): string;
}

/** The library's error a call threw, read from its JSON, or one of the page's own. */
export function failure(thrown: unknown): Failure {
  if (typeof thrown === "string") {
    try {
      const parsed = JSON.parse(thrown) as Failure;
      if (typeof parsed.code === "string") return parsed;
    } catch {
      // Not the library's JSON: worded below.
    }
    return { code: "page", kind: "internal", message: thrown };
  }
  if (thrown && typeof thrown === "object" && "code" in thrown) return thrown as Failure;
  return { code: "page", kind: "internal", message: String(thrown) };
}

/** A cut of a proof, as `cuts` lists it. */
export interface CutShown {
  /** The cut's node in the proof, which a step names. */
  readonly node: number;
  /** The cut formula as the mode reads it. */
  readonly formula: string;
  /** The drawing's inferences (`i<n>`) that show the cut. */
  readonly inferences: readonly number[];
}

/** A cut link of a net, as `net_cuts` lists it. */
export interface LinkShown {
  /** Its two ends; either names it to a step. */
  readonly ends: readonly [number, number];
  /** The id of its bar in the drawing. */
  readonly id: string;
  /** The cut formula as the mode reads it. */
  readonly formula: string;
}

/** A proof or net of an elimination with its cuts and its drawing, as `cuts` and `net_cuts` answer. */
export interface Reached {
  /** The proof's document, which the next call takes. */
  readonly proof?: unknown;
  /** The net's document, which the next call takes. */
  readonly net?: unknown;
  readonly cuts: readonly (CutShown | LinkShown)[];
  /** The cut the strategy reduces next: a node, or a cut link's ends; null when none is left. */
  readonly next: number | readonly [number, number] | null;
  /** The drawing, null where its bound refused it. */
  readonly drawing: string | null;
  readonly refused?: Failure;
}

/** A step of an elimination, as `cut_step` and `net_cut_step` answer it. */
export interface Taken {
  /** The cut reduced: its node, or its cut link's ends. */
  readonly cut: number | readonly [number, number];
  /** The cut formula as the mode reads it. */
  readonly formula: string;
  /** The case, in snake case. */
  readonly case: string;
  /** The case as a phrase: "the axiom case", "contraction", … */
  readonly name: string;
  /** The ids to highlight in the drawing the step was taken on; null where it was not drawn. */
  readonly highlight: { readonly cut: readonly string[]; readonly above: readonly string[] } | null;
}

/** One step's answer: the step, for a net the net before drawn with its marks, and what it made. */
export type Stepped = Reached & { readonly step: Taken; readonly marked?: string };

/** An elimination to the end: its steps, each with its drawing, how it ended, and what it reached. */
export type Ran = Reached & {
  readonly steps: readonly (Taken & { readonly drawing: string | null })[];
  readonly end: "cut_free" | "refused";
  /** The bound that ended it, for `refused`. */
  readonly reason?: Failure;
  /** The first step, from 1, whose drawing the bound on drawings left out. */
  readonly undrawn: number | null;
};
