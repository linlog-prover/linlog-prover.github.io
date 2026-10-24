// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The written content as the island receives it: Learn's problems, its
 * lessons, the rules and the tour's data as props (pages/index.astro), Practice's problems from
 * /problems.json when Practice first opens, and the texts, About's,
 * Practice's and Learn's, as templates in the page, each named by its
 * collection and id (`problems/axiom`, `tour/1-field`, `texts/about`) or
 * `licence`.
 */

import type { Mode } from "./linlog";

/** A level of difficulty, from 1, easy, to 4, very hard. */
export type Level = 1 | 2 | 3 | 4;

/** A problem of Learn's: a lesson's practice, provable or not. */
export interface Example {
  readonly id: string;
  readonly title: string;
  /** As it is typed in the field. */
  readonly sequent: string;
  readonly mode: Mode;
  readonly level: Level;
  readonly verdict: "provable" | "unprovable";
  /** The lesson of the progression whose practice it is, from 1. */
  readonly lesson: number;
  /** Its proof, linlog's session document as text, for a provable one. */
  readonly session: string | null;
}

/** A problem of Practice's: provable, with what it is filtered by. */
export interface Problem {
  readonly id: string;
  readonly title: string | null;
  /** As it is typed in the field. */
  readonly sequent: string;
  readonly mode: Mode;
  readonly level: Level;
  readonly categories: readonly string[];
  /** The fragment linlog detects. */
  readonly fragment: string;
  /** The work that states it, with the place, and where to read it. */
  readonly source: { readonly text: string; readonly url: string } | null;
}

/** A step of a lesson's worked proof: the rule its session applies there, and why. */
export interface Reason {
  readonly rule: string;
  readonly reason: string;
}

/** An answer of a hinge question: right without a misconception, wrong with the one it reveals. */
export interface Option {
  readonly text: string;
  readonly problem?: string | undefined;
  readonly misconception?: string | undefined;
  readonly why: string;
}

/** A written lesson of Learn's tutorial (src/content.config.ts says what each part is). */
export interface Lesson {
  readonly id: string;
  readonly lesson: number;
  readonly title: string;
  /** The id of the store problem whose proof is the worked one. */
  readonly worked: string;
  readonly choices: readonly string[];
  readonly steps: readonly Reason[];
  readonly detour: {
    readonly before: number;
    readonly left: readonly number[];
    readonly text: string;
  } | null;
  readonly faded: number;
  readonly explain: { readonly after: number; readonly prompt: string; readonly answer: string };
  readonly hinge: { readonly question: string; readonly options: readonly Option[] };
}

/** A one-sided rule as the reference draws it and the popover shows it. */
export interface Rule {
  readonly id: string;
  /** As linlog names it on the stage. */
  readonly name: string;
  readonly title: string;
  readonly lesson: number;
  readonly premises: readonly string[];
  readonly conclusion: string;
  readonly twoSided: readonly string[];
  readonly says: string;
}

/** A stop of the tour. */
export interface Stop {
  readonly id: string;
  readonly title: string;
  readonly target: "tab" | "stage" | "formula" | "goal" | "status" | "bottom";
  readonly act: "none" | "start" | "par" | "split" | "close";
}

/** A copy of a written text of the page, or an empty fragment when the page has none by that name. */
export function written(key: string): DocumentFragment {
  const template = document.querySelector<HTMLTemplateElement>(
    `template[data-content="${CSS.escape(key)}"]`,
  );
  return (
    (template?.content.cloneNode(true) as DocumentFragment | undefined) ?? new DocumentFragment()
  );
}

/** The rule linlog names `name`, by its one-sided name or one of its two-sided ones, with the name it was asked by. */
export function ruleNamed(
  rules: readonly Rule[],
  name: string,
): { readonly rule: Rule; readonly as: string } | undefined {
  const rule = rules.find((r) => r.name === name || r.twoSided.includes(name));
  return rule && { rule, as: name };
}
