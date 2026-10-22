// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The island's own view state, beside the proofs' (state.tsx): what is
 * selected, which popover or menu is open, the tree or net tab, the camera,
 * the hint ladder, the live region's message, Learn's place and the tour's
 * stop.
 */

import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import type { Hint, Offered } from "../lib/linlog";

/** A formula of a goal, by its position. */
export interface Spot {
  readonly goal: number;
  readonly position: number;
}

/** The split chooser: the rule asked for and the formulas sent to the left premise. */
export interface Split extends Spot {
  readonly rule: string;
  readonly left: readonly number[];
  /** Whether the split can still close, by `split_passes`; null while asked. */
  readonly passes: boolean | null;
}

/** The hint ladder on one goal. */
export interface Ladder {
  /** The proof and the goal's path it is for, joined. */
  readonly key: string;
  readonly rung: number;
  readonly hint: Hint | null;
}

/** Which menu or pane is open. */
export type Menu =
  | "export"
  | "import"
  | "settings"
  | "keys"
  | "status"
  | "calculus"
  | "steps"
  | "about"
  | "more"
  | null;

/** Learn's three places. */
export type Rubric = "tutorial" | "practice" | "reference";

/** Creates the view state. */
export function createUi() {
  const [ui, setUi] = createStore<{
    selected: Spot | null;
    offered: Offered[] | null;
    split: Split | null;
    menu: Menu;
    tab: "tree" | "net";
    ladder: Ladder | null;
    live: string;
    /** The mode a calculus switch asked for, until the visitor confirms the restart. */
    pendingMode: string | null;
    /** Learn's place shown, or null with Learn off. */
    learn: Rubric | null;
    /** The tour's stop shown (from 0), or null when no tour runs. */
    tour: number | null;
    /** The id of what Learn shows and marks: an engine of the reference. */
    spot: string | null;
  }>({
    selected: null,
    offered: null,
    split: null,
    menu: null,
    tab: "tree",
    ladder: null,
    live: "",
    pendingMode: null,
    learn: null,
    tour: null,
    spot: null,
  });
  /** Bumped when the drawing must be laid out again (a new drawing, a resize). */
  const [drawn, setDrawn] = createSignal(0);
  return { ui, setUi, drawn, setDrawn };
}

/** The view state's type. */
export type Ui = ReturnType<typeof createUi>;

/** The hint ladder's key for a proof's goal: the proof and the goal's path. */
export function ladderKey(proof: string, path: readonly number[]): string {
  return `${proof}:${path.join(".")}`;
}

/** A token of tokens.css as a number: a length in pixels, a duration in milliseconds. */
export function token(name: string): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}

/** The phone's width, at which tokens.css makes every control 44 pixels: as app.css's media queries. */
const PHONE = "(max-width: 640px)";

/** Whether the page is at a phone's width, as a signal. */
export const phone = (() => {
  const query = typeof window === "undefined" ? null : window.matchMedia(PHONE);
  const [matches, setMatches] = createSignal(query?.matches ?? false);
  query?.addEventListener("change", (event) => setMatches(event.matches));
  return matches;
})();
