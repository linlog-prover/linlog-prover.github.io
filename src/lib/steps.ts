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

import type { Inference, Played, Prover, SessionDoc, StepForm, View } from "./linlog";

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
      /**
       * A quantifier step's term as it took it, which its replay must take again: a ∀R or ∃L
       * step's eigenvariable by its letter, a ∃R or ∀L step's witness, null for one left open.
       */
      readonly term?: string | null;
      /**
       * With quantifiers, the principal's and the left premise's formulas by what they are
       * (`memberKeys`), which a replay finds again where it numbers the members anew.
       */
      readonly keys?: { readonly principal: string; readonly left?: readonly string[] };
    }
  | {
      readonly path: Path;
      readonly kind: "cut";
      /** The cut formula as typed, in the mode's syntax. */
      readonly formula: string;
      /** The occurrence of the cut formula, the first of the occurrences the cut added. */
      readonly occurrence: number;
      /**
       * A cut on an instance: how many `∀`s the formula is held under, one per eigenvariable
       * it names, its cut on their body; 0 otherwise.
       */
      readonly depth?: number;
      /** With quantifiers, the formulas going to the first premise by what they are. */
      readonly leftKeys?: readonly string[];
      /** The goal's positions whose formulas went to the first premise. */
      readonly left: readonly number[];
      /** The premises' formulas the cut made, which its replay must make again. */
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
  own = principal === undefined ? 0 : 1,
): number[] | undefined {
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

/** The terms a session with quantifiers took, as its view gives them, and its forest's length. */
export type Terms = Pick<View, "opened" | "forest">;

/** The rules that take a witness: `∃` one-sided, ∃R and ∀L. */
const WITNESSED = new Set(["∃", "∃R", "∀L"]);

/** The quantifier rules, one-sided and two-sided. */
const QUANTIFIER = new Set(["∀", "∃", "∀R", "∀L", "∃R", "∃L"]);

/**
 * Every member of a session with quantifiers by what it is, the same across replays: its
 * occurrence and its frame's terms, each eigenvariable and open witness named by the path of
 * the quantifier step that made it (a constant the search made, by its number). A replay
 * numbers members, terms and eigenvariables anew, but keeps every step's path. Without
 * quantifiers a member is its occurrence.
 */
export function memberKeys(doc: SessionDoc, forest: number | undefined): (m: number) => string {
  const instances = doc.instances;
  if (forest === undefined || !instances) return (m) => `o${m}`;
  const base = ((doc.sequent["fo"] as unknown[] | undefined) ?? []).length;
  const frameTerm = (m: number) => {
    const entry = m >= forest ? instances.members[m - forest] : undefined;
    return entry ? instances.frames[entry[1]]?.[1] : undefined;
  };
  // The step that made each eigenvariable or open witness: the quantifier step whose body's
  // frame pushed it.
  const madeBy = new Map<string, string>();
  const where = paths(doc);
  for (const [goal, inference] of doc.inferences.entries()) {
    if (inference.rule === undefined || !QUANTIFIER.has(inference.rule)) continue;
    const below = new Set(inference.sequent);
    const premise = doc.inferences[inference.premises?.[0] ?? -1]?.sequent ?? [];
    for (const m of premise.filter((p) => !below.has(p))) {
      const t = frameTerm(m);
      const term = t !== undefined && t >= base ? instances.terms[t - base] : undefined;
      // An eigenvariable is made by a ∀R or ∃L step, an open witness by a ∃R or ∀L step,
      // which also takes eigenvariables as its witness.
      const witnessed = WITNESSED.has(inference.rule);
      const name =
        term && "E" in term && !witnessed
          ? `E${term.E}`
          : term && "M" in term && witnessed
            ? `M${term.M}`
            : undefined;
      if (name) madeBy.set(name, (where.get(goal) ?? []).join("."));
    }
  }
  const known = new Map<number, string>();
  const termKey = (t: number): string => {
    if (t < base) return `s${t}`;
    const done = known.get(t);
    if (done !== undefined) return done;
    const term = instances.terms[t - base];
    let key = `?${t}`;
    if (term && "F" in term) key = `f${term.F[0]}(${term.F[1].map(termKey).join(",")})`;
    else if (term && "E" in term) key = `∀@${madeBy.get(`E${term.E}`) ?? `c${term.E}`}`;
    else if (term && "M" in term) key = `∃@${madeBy.get(`M${term.M}`) ?? `m${term.M}`}`;
    known.set(t, key);
    return key;
  };
  return (m) => {
    const entry = m >= forest ? instances.members[m - forest] : undefined;
    if (!entry) return `o${m}`;
    const frame: string[] = [];
    for (let f: number | null | undefined = entry[1]; f !== null && f !== undefined; ) {
      const cell: readonly [number | null, number] | undefined = instances.frames[f];
      if (!cell) break;
      frame.push(termKey(cell[1]));
      f = cell[0];
    }
    return `o${entry[0]}[${frame.join(",")}]`;
  };
}

/** The positions in `members` of the formulas `keys` name, each taken once, none `taken`. */
function positionsOf(
  members: readonly number[],
  key: (m: number) => string,
  keys: readonly string[],
  taken: boolean[],
): number[] | undefined {
  const found: number[] = [];
  for (const k of keys) {
    const at = members.findIndex((m, i) => !taken[i] && key(m) === k);
    if (at < 0) return undefined;
    taken[at] = true;
    found.push(at);
  }
  return found;
}

/**
 * A member's occurrence, and how many binders its frame opens: a member past the forest is the
 * session's `instances` entry at its offset, `[occurrence, frame]`, its frames a chain of
 * parents; any other is an occurrence under none.
 */
export function occurrenceOf(
  doc: SessionDoc,
  forest: number | undefined,
  member: number,
): { occurrence: number; depth: number } {
  const entry =
    forest !== undefined && member >= forest ? doc.instances?.members[member - forest] : undefined;
  if (!entry) return { occurrence: member, depth: 0 };
  let depth = 0;
  for (let f: number | null | undefined = entry[1]; f !== null && f !== undefined; depth++) {
    f = doc.instances?.frames[f]?.[0];
  }
  return { occurrence: entry[0], depth };
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

/**
 * What expanding a goal made: its premises' formulas, which a replay must make again. With
 * quantifiers, by occurrence, ascending: a replay that leaves out a step numbers the members
 * past the forest anew, and the term each quantifier step took is compared apart.
 */
const madeOf = (doc: SessionDoc, goal: number, forest?: number): number[][] =>
  (doc.inferences[goal]?.premises ?? []).map((p) => {
    const sequent = [...(doc.inferences[p]?.sequent ?? [])];
    if (forest === undefined) return sequent;
    return sequent.map((m) => occurrenceOf(doc, forest, m).occurrence).sort((a, b) => a - b);
  });

/** Matches a name in a term or formula. */
const NAME = /[A-Za-z_][A-Za-z0-9_']*/g;

/** Matches a name written by the path of the step that made it, `{1.0}`. */
const BY_PATH = /\{([0-9.]*)\}/g;

/**
 * Each eigenvariable's letter, to the path of the ∀R or ∃L step that made it: what a witness
 * or a cut formula names an eigenvariable by when recorded (`{1.0}`), since a replay that
 * leaves out a step letters the later ones anew, and an action on the redo stack outlives
 * several replays.
 */
function makers(doc: SessionDoc, terms: Terms): Map<string, string> {
  const where = paths(doc);
  const found = new Map<string, string>();
  for (const { inference, term } of terms.opened ?? []) {
    const rule = doc.inferences[inference]?.rule;
    if (term !== null && rule !== undefined && !WITNESSED.has(rule)) {
      found.set(term, (where.get(inference) ?? []).join("."));
    }
  }
  return found;
}

/** A witness or a formula with each eigenvariable written by its step's path. */
const byPath = (text: string, made: Map<string, string>) =>
  text.replace(NAME, (name) => {
    const path = made.get(name);
    return path === undefined ? name : `{${path}}`;
  });

/** A goal's expansion as a step, with what it made and, for a quantifier step, its term. */
function stepAction(doc: SessionDoc, goal: number, path: Path, terms?: Terms | null): Action {
  const step = stepOf(doc, goal);
  const made = madeOf(doc, goal, terms?.forest);
  if (!terms || terms.forest === undefined) return { path, kind: "step", step, made };
  const key = memberKeys(doc, terms.forest);
  const sequent = doc.inferences[goal]?.sequent ?? [];
  const keys = {
    principal: key(sequent[step.position] ?? -1),
    ...(step.left ? { left: step.left.map((p) => key(sequent[p] ?? -1)) } : {}),
  };
  const opened = terms.opened?.find((o) => o.inference === goal);
  if (!opened) return { path, kind: "step", step, made, keys };
  // A witness names eigenvariables by their steps; a ∀R or ∃L step's own letter is checked
  // only to be one.
  const term = opened.term === null ? null : byPath(opened.term, makers(doc, terms));
  const witness = WITNESSED.has(step.rule) && term !== null ? { witness: term } : {};
  return { path, kind: "step", step: { ...step, ...witness }, made, term, keys };
}

/** The cuts' formulas as typed, by their inference, as the view gives them. */
export type CutTexts = View["cuts"];

/**
 * A cut as `cut` takes it again: its formula as typed (`texts`, the view's), and the goal's
 * positions that went to the first premise, each premise its share of the goal plus one
 * formula of its own, the cut formula or its dual.
 */
function cutAction(
  doc: SessionDoc,
  goal: number,
  path: Path,
  texts: CutTexts,
  terms?: Terms | null,
): Action {
  const inference = doc.inferences[goal];
  const [first, second] = (inference?.premises ?? []).map((p) => doc.inferences[p]?.sequent ?? []);
  const left = leftOf(inference?.sequent ?? [], undefined, first ?? [], second ?? [], 1) ?? [];
  const typed = texts.find((c) => c.inference === goal)?.formula ?? "";
  const formula = terms && terms.forest !== undefined ? byPath(typed, makers(doc, terms)) : typed;
  // A cut on an instance names its body's member: the block starts at the formula's root.
  const { occurrence: body, depth } = occurrenceOf(doc, terms?.forest, inference?.cut ?? 0);
  const made = madeOf(doc, goal, terms?.forest);
  const cut = { path, kind: "cut", formula, occurrence: body - depth, depth, left, made } as const;
  if (terms?.forest === undefined) return cut;
  const key = memberKeys(doc, terms.forest);
  return { ...cut, leftKeys: left.map((p) => key(inference?.sequent[p] ?? -1)) };
}

/**
 * The session's actions, in the order they were taken; a cut with its formula as `texts`
 * (the view's `cuts`) say it was typed, and with quantifiers each step with the term it took,
 * as `terms` (the view's) say.
 */
export function actions(doc: SessionDoc, texts: CutTexts = [], terms?: Terms | null): Action[] {
  const where = paths(doc);
  const history = new Set(doc.history);
  return doc.history.map((goal): Action => {
    const path = where.get(goal) ?? [];
    if (doc.inferences[goal]?.rule === "cut") return cutAction(doc, goal, path, texts, terms);
    if (!grafted(doc, goal, history)) return stepAction(doc, goal, path, terms);
    // The graft's inferences from its root up, each as a step: what replays
    // it when the search no longer closes the goal.
    const graft: Action[] = [];
    const todo = [goal];
    for (let next = todo.shift(); next !== undefined; next = todo.shift()) {
      if (!expanded(doc.inferences[next])) continue;
      graft.push(stepAction(doc, next, where.get(next) ?? [], terms));
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
 *
 * With `invertible`, the inferences an invertible rule closed (the view's),
 * as when the page applies those rules by itself: the step taken back is the
 * nearest on the branch that is not one, so that undo takes back the
 * visitor's last choice with the invertible steps that followed it, rather
 * than one of those, which the page would only apply again. Undefined when
 * every step on the branch is one.
 */
export function retract(
  doc: SessionDoc,
  goal: number | undefined,
  invertible?: ReadonlySet<number>,
  texts: CutTexts = [],
  terms?: Terms | null,
): Retraction | undefined {
  const all = actions(doc, texts, terms);
  const inverts = (path: Path) => {
    const at = goalAt(doc, path);
    return invertible !== undefined && at !== undefined && invertible.has(at);
  };
  let reopened: Path | undefined;
  if (goal === undefined) {
    reopened = all.findLast((a) => a.kind === "close" || !inverts(a.path))?.path;
  } else {
    const path = paths(doc).get(goal);
    if (path !== undefined && path.length > 0) reopened = path.slice(0, -1);
    while (reopened !== undefined && inverts(reopened)) {
      reopened = reopened.length > 0 ? reopened.slice(0, -1) : undefined;
    }
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
 * A recorded witness or formula in the session as it stands: each eigenvariable written by its
 * step's path (`{1.0}`) as the letter that step took, undefined where no ∀R or ∃L step stands
 * at the path.
 */
function lettered(text: string, played: Played): string | undefined {
  const where = paths(played.session);
  const letter = new Map<string, string>();
  for (const { inference, term } of played.view.opened ?? []) {
    const rule = played.session.inferences[inference]?.rule;
    if (term !== null && rule !== undefined && !WITNESSED.has(rule)) {
      letter.set((where.get(inference) ?? []).join("."), term);
    }
  }
  let missing = false;
  const out = text.replace(BY_PATH, (_, path: string) => {
    const name = letter.get(path);
    if (name === undefined) missing = true;
    return name ?? "";
  });
  return missing ? undefined : out;
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
  // A cut adds its formula's occurrences after every one the session has, so a cut replayed
  // after other cuts than before (an earlier one taken back, or one redone later) has them
  // elsewhere: each block a recorded cut added, its formula's tree then its dual's, is moved
  // to where its replay put it, and what an action made is compared through the moves.
  const moves: { from: number; to: number; by: number }[] = [];
  const moved = (made: readonly (readonly number[])[]) =>
    made.map((premise) =>
      premise.map((o) => o + (moves.find((m) => m.from <= o && o < m.to)?.by ?? 0)),
    );
  // Eigenvariables are lettered in the order their ∀R and ∃L steps are taken, so a replay that
  // leaves one out letters the later ones anew: a recorded witness or cut formula names each by
  // its step's path, read as the letter that step took in this replay (`lettered`).
  const quantified = (next: Played) => next.view.forest;
  const step = (action: Action & { kind: "step" }): boolean => {
    const goal = goalAt(played.session, action.path);
    if (goal === undefined || expanded(played.session.inferences[goal])) return false;
    const witness =
      action.step.witness === undefined ? undefined : lettered(action.step.witness, played);
    if (action.step.witness !== undefined && witness === undefined) return false;
    let form: StepForm = witness === undefined ? action.step : { ...action.step, witness };
    // With quantifiers the formulas are found by what they are: a replay numbers the members
    // past the forest anew, and so may order a goal's formulas otherwise.
    if (action.keys && played.view.forest !== undefined) {
      const key = memberKeys(played.session, played.view.forest);
      const members = played.session.inferences[goal]?.sequent ?? [];
      const taken = members.map(() => false);
      const [principal] = positionsOf(members, key, [action.keys.principal], taken) ?? [];
      const left = action.keys.left && positionsOf(members, key, action.keys.left, taken);
      if (principal === undefined || (action.keys.left && !left)) return false;
      form = { ...form, position: principal, ...(left ? { left } : {}) };
    }
    try {
      const next = JSON.parse(
        prover.apply(JSON.stringify(played.session), goal, JSON.stringify(form), settings),
      ) as Played;
      const took = next.view.opened?.find((o) => o.inference === goal)?.term;
      const term = action.term;
      const witnessed = WITNESSED.has(action.step.rule);
      // A quantifier step takes its term again: the same witness, or open where it was, and a
      // ∀R or ∃L step an eigenvariable.
      const kept =
        term === undefined ||
        (witnessed
          ? took === (term === null ? null : lettered(term, played))
          : typeof took === "string");
      if (!kept || !same(madeOf(next.session, goal, quantified(next)), moved(action.made))) {
        played = JSON.parse(prover.undo(JSON.stringify(next.session), settings)) as Played;
        return false;
      }
      played = next;
      return true;
    } catch {
      return false;
    }
  };
  const cut = (action: Action & { kind: "cut" }): boolean => {
    const goal = goalAt(played.session, action.path);
    if (goal === undefined || expanded(played.session.inferences[goal])) return false;
    let left: readonly number[] | undefined = action.left;
    if (action.leftKeys && played.view.forest !== undefined) {
      const key = memberKeys(played.session, played.view.forest);
      const members = played.session.inferences[goal]?.sequent ?? [];
      left = positionsOf(
        members,
        key,
        action.leftKeys,
        members.map(() => false),
      );
      if (!left) return false;
    }
    const formula = lettered(action.formula, played);
    if (formula === undefined) return false;
    try {
      const next = JSON.parse(
        prover.cut(JSON.stringify(played.session), goal, formula, JSON.stringify(left), settings),
      ) as Played;
      // The recorded dual is the second premise's one occurrence of the block, of the body
      // under the formula's ∀s for a cut on an instance.
      const depth = action.depth ?? 0;
      const from = action.occurrence;
      const dual = Math.max(...(action.made[1] ?? [])) - depth;
      const cutMember = next.session.inferences[goal]?.cut;
      if (cutMember === undefined || dual < from) return false;
      const placed = occurrenceOf(next.session, quantified(next), cutMember).occurrence - depth;
      const move = { from, to: from + 2 * (dual - from), by: placed - from };
      moves.push(move);
      if (!same(madeOf(next.session, goal, quantified(next)), moved(action.made))) {
        moves.pop();
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
    if (action.kind === "cut") {
      if (!cut(action)) failed.push(action.path);
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
