// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The written content as the island receives it: the examples' and the
 * tour's data as props (pages/index.astro), and their texts, About's and
 * Learn's as templates in the page, each named by its collection and id
 * (`examples/axiom`, `tour/1-field`, `texts/about`) or `licence`.
 */

import type { Mode } from "./linlog";

/** An example of Learn's practice. */
export interface Example {
  readonly id: string;
  readonly title: string;
  /** As it is typed in the field. */
  readonly sequent: string;
  readonly mode: Mode;
  readonly difficulty: 1 | 2 | 3;
  readonly verdict: "provable" | "unprovable";
  /** Its proof, linlog's session document as text, for a provable one. */
  readonly session: string | null;
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
