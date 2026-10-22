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
  | {
      readonly path: Path;
      readonly kind: "step";
      readonly step: StepForm;
      /** The premises' formulas the step made, which its replay must make again. */
      readonly made: readonly (readonly number[])[];
    }
  | {
      readonly path: Path;
      readonly kind: "close";
      /** The graft's inferences as steps, from its root up. */
      readonly graft: readonly Action[];
      /** A graft that was no search's (a proof filled in from another tab): replayed from its inferences alone. */
      readonly own?: boolean;
    };

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
 * The left premise's share of a goal split between two premises: the
 * positions of `goal` (but the principal's, `principal`) whose formulas went
 * to the left premise, found by aligning the goal with the two premises.
 * Each premise is its share of the goal in the goal's order, plus, where the
 * rule has a principal, one formula of its own (the principal's subformula),
 * which may carry the same occurrence as a formula of the context once a
 * contraction has copied it; so the alignment searches every way of
 * interleaving, not the counts. Undefined when there is none.
 */
export function leftOf(
  goal: readonly number[],
  principal: number | undefined,
  left: readonly number[],
  right: readonly number[],
): number[] | undefined {
  const own = principal === undefined ? 0 : 1;
  const dead = new Set<string>();
  const chosen: number[] = [];
  // i: the goal's next position; a, b: each premise's next formula; c, d:
  // whether each premise's own formula is placed yet.
  const walk = (i: number, a: number, b: number, c: number, d: number): boolean => {
    const key = `${i},${a},${b},${c},${d}`;
    if (dead.has(key)) return false;
    if (i === principal) {
      if (walk(i + 1, a, b, c, d)) return true;
      dead.add(key);
      return false;
    }
    if (c < own && a < left.length && walk(i, a + 1, b, c + 1, d)) return true;
    if (d < own && b < right.length && walk(i, a, b + 1, c, d + 1)) return true;
    if (i === goal.length) {
      if (a === left.length && b === right.length && c === own && d === own) return true;
      dead.add(key);
      return false;
    }
    if (goal[i] === left[a]) {
      chosen.push(i);
      if (walk(i + 1, a + 1, b, c, d)) return true;
      chosen.pop();
    }
    if (goal[i] === right[b] && walk(i + 1, a, b + 1, c, d)) return true;
    dead.add(key);
    return false;
  };
  return walk(0, 0, 0, 0, 0) ? chosen : undefined;
}

/**
 * The step that expanded a goal, as `apply` takes it again: the principal's
 * position, and where the rule splits the goal's context between two
 * premises (`⊗`, Mix, the two-sided splits), the positions whose formulas
 * went to the left premise. A rule that copies the context (`&`) takes no
 * split: there the premises hold the context twice over.
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
  const context = inference.sequent.length - (inference.principal === undefined ? 0 : 1);
  if (left.length + right.length - context > 2) return { position, rule: inference.rule };
  const share = leftOf(inference.sequent, inference.principal, left, right);
  return share
    ? { position, rule: inference.rule, left: share }
    : { position, rule: inference.rule };
}

/** What expanding a goal made: its premises' formulas, which a replay must make again. */
const madeOf = (doc: SessionDoc, goal: number): number[][] =>
  (doc.inferences[goal]?.premises ?? []).map((p) => [...(doc.inferences[p]?.sequent ?? [])]);

/** A goal's expansion as a step, with what it made. */
function stepAction(doc: SessionDoc, goal: number, path: Path): Action {
  return { path, kind: "step", step: stepOf(doc, goal), made: madeOf(doc, goal) };
}

/** The session's actions, in the order they were taken. */
export function actions(doc: SessionDoc): Action[] {
  const where = paths(doc);
  const history = new Set(doc.history);
  return doc.history.map((goal): Action => {
    const path = where.get(goal) ?? [];
    if (!grafted(doc, goal, history)) return stepAction(doc, goal, path);
    // The graft's inferences from its root up, each as a step: what replays
    // it when the search no longer closes the goal.
    const graft: Action[] = [];
    const todo = [goal];
    for (let next = todo.shift(); next !== undefined; next = todo.shift()) {
      if (!expanded(doc.inferences[next])) continue;
      graft.push(stepAction(doc, next, where.get(next) ?? []));
      todo.push(...(doc.inferences[next]?.premises ?? []));
    }
    return { path, kind: "close", graft };
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

const same = (a: readonly (readonly number[])[], b: readonly (readonly number[])[]) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Plays actions onto a session, each on the goal at its path. A step goes
 * through `apply` and must make the premises it made before, or it is taken
 * back (`undo`) and its goal left open. A graft goes through `close` again
 * (deterministic: one thread, bounded by work, not time), and where the
 * search no longer closes the goal within these settings (it closed it under
 * a larger budget), through its own inferences as steps, which keep it
 * closed though no longer set apart as the search's; a graft of its own (a
 * proof filled in from another tab) replays from its inferences alone. A goal that cannot be
 * expanded again is reported by its path, and the actions under it left out.
 */
export function play(
  prover: Prover,
  start: Played,
  todo: readonly Action[],
  settings: string,
): Replayed {
  let played: Played = start;
  const failed: Path[] = [];
  const step = (action: Action & { kind: "step" }): boolean => {
    const goal = goalAt(played.session, action.path);
    if (goal === undefined || expanded(played.session.inferences[goal])) return false;
    try {
      const next = JSON.parse(
        prover.apply(JSON.stringify(played.session), goal, JSON.stringify(action.step), settings),
      ) as Played;
      if (!same(madeOf(next.session, goal), action.made)) {
        played = JSON.parse(prover.undo(JSON.stringify(next.session), settings)) as Played;
        return false;
      }
      played = next;
      return true;
    } catch {
      return false;
    }
  };
  for (const action of todo) {
    if (failed.some((path) => within(action.path, path))) continue;
    if (action.kind === "step") {
      if (!step(action)) failed.push(action.path);
      continue;
    }
    const goal = goalAt(played.session, action.path);
    if (goal === undefined || expanded(played.session.inferences[goal])) {
      failed.push(action.path);
      continue;
    }
    try {
      const closed = action.own
        ? undefined
        : (JSON.parse(prover.close(JSON.stringify(played.session), goal, settings)) as Played & {
            outcome: { verdict: string };
            refused: unknown;
          });
      if (closed?.outcome.verdict === "proved" && !closed.refused) {
        played = closed;
        continue;
      }
    } catch {
      // Replayed from its inferences below.
    }
    for (const inner of action.graft) {
      if (inner.kind === "step" && !step(inner)) {
        failed.push(action.path);
        break;
      }
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
