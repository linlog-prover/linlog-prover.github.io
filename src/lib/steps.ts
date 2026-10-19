// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The step tree: the session's actions as a tree of goals, undo per branch
 * and redo by replaying it.
 *
 * The library's own `undo` retracts the last step of the session, whatever
 * goal it was on. Undo here retracts the last step on the active goal's
 * branch: the step that opened the goal, with every step taken since in any
 * premise of that step, and keeps every other branch's steps. The session is
 * rebuilt by replaying the steps kept, in their order, from the sequent.
 *
 * The tree is read off the session document itself, never kept beside it: a
 * session restored from a link, a file or the browser's storage has the same
 * tree as one proved on the page. A goal is named by its path from the root
 * (the premise taken at each inference), never by its number: the library
 * numbers inferences in the order they are made, so a replay that leaves a
 * step out numbers every later one differently, while the paths stay.
 */

import type { Inference, Played, Prover, SessionDoc, StepForm } from "./linlog";

/** A goal's place in the tree: the premise taken at each inference from the root. */
export type Path = readonly number[];

/** What expanded a goal: a step the student applied, or a search's graft. */
export type Action =
  | { readonly path: Path; readonly kind: "step"; readonly step: StepForm }
  | { readonly path: Path; readonly kind: "close" };

/** Every expanded and open inference's path, by its number. */
export function paths(doc: SessionDoc): Map<number, Path> {
  const found = new Map<number, Path>([[0, []]]);
  const todo: number[] = [0];
  for (let next = todo.pop(); next !== undefined; next = todo.pop()) {
    const path = found.get(next) ?? [];
    for (const [index, premise] of (doc.inferences[next]?.premises ?? []).entries()) {
      found.set(premise, [...path, index]);
      todo.push(premise);
    }
  }
  return found;
}

/** The inference at a path, if the tree has one there. */
export function goalAt(doc: SessionDoc, path: Path): number | undefined {
  let goal = 0;
  for (const index of path) {
    const next = doc.inferences[goal]?.premises?.[index];
    if (next === undefined) return undefined;
    goal = next;
  }
  return goal;
}

/** Whether `path` lies at or under `under`. */
export function within(path: Path, under: Path): boolean {
  return under.length <= path.length && under.every((index, i) => path[i] === index);
}

/** The inferences under one, itself included. */
function subtree(doc: SessionDoc, root: number): number[] {
  const found: number[] = [];
  const todo = [root];
  for (let next = todo.pop(); next !== undefined; next = todo.pop()) {
    found.push(next);
    todo.push(...(doc.inferences[next]?.premises ?? []));
  }
  return found;
}

const expanded = (inference: Inference | undefined) => inference?.rule !== undefined;

/**
 * Whether a history entry was a search's graft: a premise of it was expanded
 * without being in the history. A graft of a single inference with no
 * premises (an axiom) reads as a step, which replays to the same tree.
 */
function grafted(doc: SessionDoc, goal: number, history: ReadonlySet<number>): boolean {
  return (doc.inferences[goal]?.premises ?? []).some(
    (premise) => expanded(doc.inferences[premise]) && !history.has(premise),
  );
}

/** The inferences the search made, which the drawing sets apart from the student's. */
export function searchMade(doc: SessionDoc): Set<number> {
  const history = new Set(doc.history);
  const made = new Set<number>();
  for (const goal of doc.history) {
    if (grafted(doc, goal, history)) for (const n of subtree(doc, goal)) made.add(n);
  }
  return made;
}

/**
 * The step that expanded a goal, as `apply` takes it again: the principal's
 * position, and where the rule splits the goal's context between two
 * premises (`⊗`, Mix, the two-sided splits), the positions whose formulas
 * went to the left premise. A rule that copies the context (`&`) takes no
 * split: there every formula is in both premises.
 */
export function stepOf(doc: SessionDoc, goal: number): StepForm {
  const inference = doc.inferences[goal];
  if (inference?.rule === undefined) throw new Error(`goal ${goal} has no rule`);
  const position = inference.principal ?? 0;
  const premises = (inference.premises ?? []).map((p) => doc.inferences[p]?.sequent ?? []);
  const [left, right] = premises;
  if (premises.length !== 2 || left === undefined || right === undefined) {
    return { position, rule: inference.rule };
  }
  const context = inference.sequent
    .map((occurrence, at) => ({ occurrence, at }))
    .filter(({ at }) => inference.principal === undefined || at !== inference.principal);
  const counts = (sequent: readonly number[]) => {
    const count = new Map<number, number>();
    for (const o of sequent) count.set(o, (count.get(o) ?? 0) + 1);
    return count;
  };
  const inLeft = counts(left);
  const inRight = counts(right);
  const contextOccurrences = new Set(context.map(({ occurrence }) => occurrence));
  let shared = 0;
  for (const o of contextOccurrences) shared += (inLeft.get(o) ?? 0) + (inRight.get(o) ?? 0);
  // Copied (every formula in both premises) unless each went to exactly one.
  if (shared !== context.length) return { position, rule: inference.rule };
  const leftPositions: number[] = [];
  for (const { occurrence, at } of context) {
    const remaining = inLeft.get(occurrence) ?? 0;
    if (remaining > 0) {
      leftPositions.push(at);
      inLeft.set(occurrence, remaining - 1);
    }
  }
  return { position, rule: inference.rule, left: leftPositions };
}

/** The session's actions, in the order they were taken. */
export function actions(doc: SessionDoc): Action[] {
  const where = paths(doc);
  const history = new Set(doc.history);
  return doc.history.map((goal): Action => {
    const path = where.get(goal) ?? [];
    return grafted(doc, goal, history)
      ? { path, kind: "close" }
      : { path, kind: "step", step: stepOf(doc, goal) };
  });
}

/** A retraction: the actions kept, those taken back (for redo), and the goal it reopens. */
export interface Retraction {
  readonly kept: readonly Action[];
  readonly removed: readonly Action[];
  readonly reopened: Path;
}

/**
 * Undo on a goal: the last step on its branch and every step taken since in
 * that step's premises. For an open goal that is the step that opened it;
 * with no goal (a finished proof) it is the last action of all. Undefined
 * when there is nothing to take back: the goal is the root, still open.
 */
export function retract(doc: SessionDoc, goal: number | undefined): Retraction | undefined {
  const all = actions(doc);
  let reopened: Path | undefined;
  if (goal === undefined) {
    reopened = all.at(-1)?.path;
  } else {
    const path = paths(doc).get(goal);
    if (path !== undefined && path.length > 0) reopened = path.slice(0, -1);
  }
  if (reopened === undefined) return undefined;
  const under = reopened;
  return {
    kept: all.filter((a) => !within(a.path, under)),
    removed: all.filter((a) => within(a.path, under)),
    reopened,
  };
}

/** What a replay ended with: the session, and the paths it could not expand again. */
export interface Replayed extends Played {
  readonly failed: readonly Path[];
}

/**
 * Plays actions onto a session, each on the goal at its path: a step through
 * `apply`, a graft through `close`, the search run again with the same
 * settings (it is deterministic: one thread, bounded by work, not time).
 * A step the library refuses, or a search that no longer proves its goal
 * (the budget was lowered since), leaves that goal open; its path is
 * reported, and the actions under it are left out.
 */
export function play(
  prover: Prover,
  start: Played,
  todo: readonly Action[],
  settings: string,
): Replayed {
  let played: Played = start;
  const failed: Path[] = [];
  for (const action of todo) {
    if (failed.some((path) => within(action.path, path))) continue;
    const goal = goalAt(played.session, action.path);
    if (goal === undefined || expanded(played.session.inferences[goal])) {
      failed.push(action.path);
      continue;
    }
    const session = JSON.stringify(played.session);
    try {
      if (action.kind === "step") {
        played = JSON.parse(
          prover.apply(session, goal, JSON.stringify(action.step), settings),
        ) as Played;
      } else {
        const closed = JSON.parse(prover.close(session, goal, settings)) as Played & {
          outcome: { verdict: string };
          refused: unknown;
        };
        if (closed.outcome.verdict !== "proved" || closed.refused) failed.push(action.path);
        played = closed;
      }
    } catch {
      failed.push(action.path);
    }
  }
  return { ...played, failed };
}

/** Replays actions from the session's sequent, in its mode. */
export function replay(
  prover: Prover,
  doc: SessionDoc,
  todo: readonly Action[],
  settings: string,
): Replayed {
  const start = JSON.parse(prover.start(JSON.stringify(doc.sequent), doc.mode, settings)) as Played;
  return play(prover, start, todo, settings);
}
