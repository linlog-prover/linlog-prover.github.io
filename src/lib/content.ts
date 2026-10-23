// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The written content as the island receives it: Learn's problems and the
 * tour's data as props (pages/index.astro), Practice's problems from
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
