// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Offered, Played, SessionDoc } from "./linlog";
import { actions, goalAt, paths, play, replay, retract, searchMade } from "./steps";
import { linlog } from "./testing";

const S = "";

function started(text: string, mode = "classical"): Played {
  const read = JSON.parse(linlog.read(text, S));
  return JSON.parse(linlog.start(JSON.stringify(read.sequent), mode, S));
}

function step(played: Played, goal: number, position: number, rule: string, left?: number[]) {
  const form = left ? { position, rule, left } : { position, rule };
  return JSON.parse(
    linlog.apply(JSON.stringify(played.session), goal, JSON.stringify(form), S),
  ) as Played & { opened: number[] };
}

const same = (a: SessionDoc, b: SessionDoc) => expect(JSON.stringify(a)).toBe(JSON.stringify(b));

describe("the step tree", () => {
  it("replays a session's own actions to the same session", () => {
    let p = started("A * B |- B * A");
    p = step(p, 0, 0, "⅋");
    const split = step(p, 1, 2, "⊗", [1]);
    const closed = JSON.parse(linlog.close(JSON.stringify(split.session), split.opened[1] ?? 0, S));
    const doc: SessionDoc = closed.session;
    same(replay(linlog, doc, actions(doc), S).session, doc);
  });

  it("undoes the last step on the active goal's branch, keeping later steps elsewhere", () => {
    // & copies the context to two premises; the right one's ⅋ comes first,
    // then the left one's, so the session's last step is on the other branch.
    let p = started("|- (~A | A) & (~B | B)");
    const and = step(p, 0, 0, "&");
    const [leftGoal, rightGoal] = and.opened as [number, number];
    const right = step(and, rightGoal, 0, "⅋");
    p = step(right, leftGoal, 0, "⅋");
    const doc = p.session;
    const active = right.opened[0] ?? -1;
    const back = retract(doc, active);
    expect(back?.reopened).toEqual([1]);
    expect(back?.removed.map((a) => a.path)).toEqual([[1]]);
    const after = replay(linlog, doc, back?.kept ?? [], S);
    expect(after.failed).toEqual([]);
    const reopened = goalAt(after.session, [1]);
    expect(after.session.inferences[reopened ?? -1]?.rule).toBeUndefined();
    expect(after.session.inferences[goalAt(after.session, [0]) ?? -1]?.rule).toBe("⅋");
  });

  it("with the invertible rules applied by themselves, undoes the step they followed", () => {
    const on = JSON.stringify({ interactive: { invertible: true } });
    const begin = (text: string): Played => {
      const read = JSON.parse(linlog.read(text, S));
      return JSON.parse(linlog.start(JSON.stringify(read.sequent), "classical", on));
    };
    // The visitor's ⊗ at the root; the axiom on its left premise and the ⅋ on its right
    // one followed it by themselves.
    const start = begin("|- A * (B par C), ~A, ~B, ~C");
    const form = JSON.stringify({ position: 0, rule: "⊗", left: [1] });
    const split = JSON.parse(linlog.apply(JSON.stringify(start.session), 0, form, on)) as Played & {
      opened: number[];
    };
    const active = split.opened[0] ?? -1;
    expect(retract(split.session, active)?.reopened).toEqual([1]);
    const back = retract(split.session, active, new Set(split.view.invertible));
    expect(back?.reopened).toEqual([]);
    expect(back?.removed.map((a) => a.path)).toEqual([[], [0], [1]]);
    // Where every step on the branch is one the page took, there is nothing to undo.
    const root = begin("A -o B, B -o C |- A -o C");
    const goal = root.view.goals[0]?.goal ?? -1;
    expect(retract(root.session, goal)?.reopened).toEqual([]);
    expect(retract(root.session, goal, new Set(root.view.invertible))).toBeUndefined();
  });

  it("undoing past a split retracts the steps in its other premise too", () => {
    let p = started("A * B |- B * A");
    p = step(p, 0, 0, "⅋");
    const split = step(p, 1, 2, "⊗", [1]);
    const [first, second] = split.opened as [number, number];
    const done = step(split, second, 0, "ax");
    const back = retract(done.session, first);
    expect(back?.reopened).toEqual([0]);
    expect(back?.kept.map((a) => a.path)).toEqual([[]]);
    expect(back?.removed).toHaveLength(2);
  });

  it("sets the search's inferences apart from the student's", () => {
    const p = step(started("!A |- A * A"), 0, 0, "?c");
    const closed = JSON.parse(linlog.close(JSON.stringify(p.session), 1, S));
    const made = searchMade(closed.session);
    expect(made.has(0)).toBe(false);
    expect(made.has(1)).toBe(true);
    expect(actions(closed.session).map((a) => a.kind)).toEqual(["step", "close"]);
  });

  it("keeps every other branch through any undo of a random proof attempt", () => {
    const sequents = [
      "A * B |- B * A",
      "|- (~A | A) & (~B | B)",
      "!A |- A * A",
      "A, B, C |- (A * B) * C",
      "A & B |- B + A",
      "|- ?(A * B), C * D",
      "!(A * B) |- (A * B) * (A * B)",
    ];
    fc.assert(
      fc.property(
        fc.constantFrom(...sequents),
        fc.array(fc.nat(1000), { minLength: 1, maxLength: 14 }),
        (text, choices) => {
          let p = started(text);
          // A random walk of legal steps, each picked by the choices.
          for (const choice of choices) {
            const goals = p.view.goals;
            const goal = goals[choice % Math.max(goals.length, 1)];
            if (!goal) break;
            const position = choice % goal.formulas.length;
            const offered: Offered[] = JSON.parse(
              linlog.rules(JSON.stringify(p.session), goal.goal, position, S),
            );
            const rule = offered[choice % Math.max(offered.length, 1)];
            if (!rule) continue;
            const others = goal.formulas.map((_, i) => i).filter((i) => i !== position);
            const left = rule.split ? others.filter((i) => (choice >> i) & 1) : undefined;
            try {
              p = step(p, goal.goal, position, rule.rule, left);
            } catch {
              // A refusal by the context: the walk goes on from the same session.
            }
          }
          const doc = p.session;
          same(replay(linlog, doc, actions(doc), S).session, doc);
          for (const { goal } of p.view.goals) {
            const back = retract(doc, goal);
            if (!back) continue;
            const after = replay(linlog, doc, back.kept, S);
            expect(after.failed).toEqual([]);
            const where = paths(after.session);
            const open = new Set(after.view.goals.map((g) => g.goal));
            expect(open.has(goalAt(after.session, back.reopened) ?? -1)).toBe(true);
            for (const kept of back.kept) {
              const at = goalAt(after.session, kept.path);
              expect(at !== undefined && where.has(at) && !open.has(at)).toBe(true);
            }
          }
        },
      ),
      { numRuns: 150 },
    );
  });

  it("reads a split right where a contraction gave a context formula the subformula's occurrence", () => {
    // ⊢ ?(A ⊗ B), C ⊗ D: contract and derelict twice, so both A ⊗ B share
    // their occurrences; split the first with the other copy left, then the
    // goal A ⊗ B, A with A left, whose left premise holds two formulas of
    // one occurrence.
    let p: Played & { opened?: number[] } = started("|- ?(A * B), C * D");
    p = step(p, 0, 0, "?c");
    p = step(p, p.opened?.[0] ?? -1, 0, "?d");
    p = step(p, p.opened?.[0] ?? -1, 0, "?d");
    const tensors = p.opened?.[0] ?? -1;
    p = step(p, tensors, 0, "⊗", [1]);
    const [first] = p.opened as [number, number];
    const goal = p.view.goals.find((g) => g.goal === first);
    expect(goal?.formulas.map((f) => f.text)).toEqual(["A ⊗ B", "A"]);
    p = step(p, first, 0, "⊗", [1]);
    expect(p.session.inferences[p.opened?.[0] ?? -1]?.sequent).toEqual([2, 2]);
    const doc = p.session;
    same(replay(linlog, doc, actions(doc), S).session, doc);
  });

  it("keeps a goal the search closed under a larger budget through an undo elsewhere", () => {
    const small = JSON.stringify({ limits: { work: 32 } });
    const large = JSON.stringify({ limits: { work: 64 } });
    let p = started("A * (B + C) |- ((A * B) + (A * C)) & (D -o D)");
    const and = step(p, 0, 1, "&");
    const [left, right] = and.opened as [number, number];
    const tried = JSON.parse(linlog.close(JSON.stringify(and.session), left, small));
    expect(tried.outcome.verdict).toBe("unknown");
    const closed = JSON.parse(linlog.close(JSON.stringify(and.session), left, large));
    expect(closed.outcome.verdict).toBe("proved");
    p = { session: closed.session, view: closed.view };
    const par = step(
      p,
      right,
      closed.view.goals[0]?.formulas.findIndex((f: { text: string }) => f.text.includes("⅋")) ?? 0,
      "⅋",
    );
    const back = retract(par.session, par.opened[0]);
    const after = replay(linlog, par.session, back?.kept ?? [], small);
    expect(after.failed).toEqual([]);
    expect(after.session.inferences[goalAt(after.session, [0]) ?? -1]?.rule).toBeDefined();
  });

  it("replays a cut with its formula as typed, in both logics, through an undo elsewhere", () => {
    for (const [text, mode, formula, left, typed] of [
      ["A, A -o B |- B", "classical", "A -o B", [1], "A ⊸ B"],
      ["A, A -o B, B -o C |- C", "intuitionistic", "B", [0, 1], "B"],
    ] as const) {
      // Typed, as the page starts a tab: a classical session keeps how it was written.
      const p = JSON.parse(linlog.start(text, mode, S)) as Played;
      const tree = (doc: SessionDoc) => JSON.stringify([doc.sequent, doc.inferences, doc.history]);
      const cut = JSON.parse(
        linlog.cut(JSON.stringify(p.session), 0, formula, JSON.stringify(left), S),
      ) as Played & { opened: number[] };
      expect(cut.view.cuts).toEqual([{ inference: 0, formula: typed }]);
      const all = actions(cut.session, cut.view.cuts);
      expect(all[0]).toMatchObject({ kind: "cut", path: [], formula: typed, left });
      expect(tree(replay(linlog, cut.session, all, S).session)).toBe(tree(cut.session));
      // The second premise closed by the search, then taken back: the cut stays.
      const second = cut.opened[1] ?? -1;
      const used = JSON.parse(linlog.close(JSON.stringify(cut.session), second, S)) as Played;
      const back = retract(used.session, undefined, undefined, used.view.cuts);
      expect(back?.kept).toEqual([all[0]]);
      const after = replay(linlog, used.session, back?.kept ?? [], S);
      expect(after.failed).toEqual([]);
      expect(tree(after.session)).toBe(tree(cut.session));
    }
  });

  it("keeps a cut on another branch through an undo of an earlier cut, and redoes it", () => {
    // ⊢ ~A, ~B, A ⊗ B split into ⊢ ~A, A and ⊢ ~B, B; each cut, the first one's first.
    const p = JSON.parse(linlog.start("A, B |- A * B", "classical", S)) as Played;
    const split = step(p, 0, 2, "⊗", [0]);
    const [first, second] = split.opened as [number, number];
    const cutOn = (played: Played, goal: number, formula: string) =>
      JSON.parse(linlog.cut(JSON.stringify(played.session), goal, formula, "[0]", S)) as Played & {
        opened: number[];
      };
    const one = cutOn(split, first, "A * A");
    const two = cutOn(one, second, "B");
    const back = retract(two.session, one.opened[0], undefined, two.view.cuts);
    expect(back?.reopened).toEqual([0]);
    const after = replay(linlog, two.session, back?.kept ?? [], S);
    expect(after.failed).toEqual([]);
    expect(after.session.inferences[goalAt(after.session, [1]) ?? -1]?.rule).toBe("cut");
    const again = play(linlog, after, back?.removed ?? [], S);
    expect(again.failed).toEqual([]);
    expect(again.session.inferences[goalAt(again.session, [0]) ?? -1]?.rule).toBe("cut");
  });

  describe("at first order", () => {
    /** The position in a goal of the formula written `text`. */
    const at = (played: Played, goal: number, text: string) => {
      const formulas = played.view.goals.find((g) => g.goal === goal)?.formulas ?? [];
      const i = formulas.findIndex((f) => (f.reading ?? f.text) === text);
      if (i < 0) throw new Error(`no ${text} in goal ${goal}`);
      return i;
    };
    const apply = (played: Played, goal: number, form: object) =>
      JSON.parse(
        linlog.apply(JSON.stringify(played.session), goal, JSON.stringify(form), S),
      ) as Played & { opened: number[] };
    const shown = (played: Played) =>
      played.view.goals.flatMap((g) => g.formulas.map((f) => f.reading ?? f.text));

    it("maps the eigenvariables' letters through an undo on another branch", () => {
      const text = "forall x. p(x), forall x. q(x) |- (forall y. p(y)) * (forall y. q(y))";
      let p = JSON.parse(linlog.start(text, "intuitionistic", S)) as Played & { opened: number[] };
      const left = at(p, 0, "∀x. p(x)");
      p = apply(p, 0, { position: at(p, 0, "(∀y. p(y)) ⊗ (∀y. q(y))"), rule: "⊗R", left: [left] });
      const [first, second] = p.opened as [number, number];
      // a on the first branch, b on the second, each its ∀L's witness.
      p = apply(p, first, { position: at(p, first, "∀y. p(y)"), rule: "∀R" });
      const a = p.opened[0] ?? -1;
      p = apply(p, a, { position: at(p, a, "∀x. p(x)"), rule: "∀L", witness: "a" });
      p = apply(p, second, { position: at(p, second, "∀y. q(y)"), rule: "∀R" });
      const b = p.opened[0] ?? -1;
      p = apply(p, b, { position: at(p, b, "∀x. q(x)"), rule: "∀L", witness: "b" });
      expect(shown(p)).toContain("q(b)");
      const back = retract(p.session, a, undefined, p.view.cuts, p.view);
      const after = play(linlog, started(text, "intuitionistic"), back?.kept ?? [], S);
      expect(after.failed).toEqual([]);
      // The second branch's eigenvariable is the first now, its witness with it.
      expect(shown(after)).toContain("q(a)");
      expect(shown(after)).not.toContain("q(b)");
    });

    it("refuses a step whose witness was changed between save and replay", () => {
      const text = "p(c) |- exists y. (p(y) * (q(d) -o q(d)))";
      const p = JSON.parse(linlog.start(text, "intuitionistic", S)) as Played;
      const taken = apply(p, 0, {
        position: at(p, 0, "∃y. (p(y) ⊗ (q(d) ⊸ q(d)))"),
        rule: "∃R",
        witness: "c",
      });
      const all = actions(taken.session, taken.view.cuts, taken.view);
      expect(all[0]).toMatchObject({ kind: "step", step: { witness: "c" }, term: "c" });
      // Saved with c, replayed with d: the same position and occurrences, another witness.
      const changed = all.map((action) =>
        action.kind === "step" ? { ...action, step: { ...action.step, witness: "d" } } : action,
      );
      expect(replay(linlog, taken.session, changed, S).failed).toEqual([[]]);
      expect(replay(linlog, taken.session, all, S).failed).toEqual([]);
    });

    it("redoes a step whose witness names an eigenvariable an undo since lettered anew", () => {
      const text =
        "forall x. p(x), forall x. q(x) |- (forall y. p(y)) * (forall y. forall z. q(z))";
      let p = JSON.parse(linlog.start(text, "intuitionistic", S)) as Played & { opened: number[] };
      const left = at(p, 0, "∀x. p(x)");
      p = apply(p, 0, {
        position: at(p, 0, "(∀y. p(y)) ⊗ (∀y. (∀z. q(z)))"),
        rule: "⊗R",
        left: [left],
      });
      const [first, second] = p.opened as [number, number];
      p = apply(p, first, { position: at(p, first, "∀y. p(y)"), rule: "∀R" });
      const a = p.opened[0] ?? -1;
      p = apply(p, second, { position: at(p, second, "∀y. (∀z. q(z))"), rule: "∀R" });
      let g = p.opened[0] ?? -1;
      p = apply(p, g, { position: at(p, g, "∀z. q(z)"), rule: "∀R" });
      g = p.opened[0] ?? -1;
      p = apply(p, g, { position: at(p, g, "∀x. q(x)"), rule: "∀L", witness: "b" });
      expect(shown(p)).toEqual(expect.arrayContaining(["q(b)", "q(c)"]));
      // Undo the ∀L, then the first branch's ∀R: the second's eigenvariables become a and b.
      const undo = (played: Played, goal: number) => {
        const back = retract(played.session, goal, undefined, played.view.cuts, played.view);
        const after = play(linlog, started(text, "intuitionistic"), back?.kept ?? [], S);
        expect(after.failed).toEqual([]);
        return { after, removed: back?.removed ?? [] };
      };
      const one = undo(p, p.opened[0] ?? -1);
      const two = undo(one.after, goalAt(one.after.session, [0, 0]) ?? -1);
      void a;
      expect(shown(two.after)).toContain("q(b)");
      expect(shown(two.after)).not.toContain("q(c)");
      // Redo both: the witness names the second branch's first eigenvariable, a now.
      const redone = play(linlog, play(linlog, two.after, two.removed, S), one.removed, S);
      expect(redone.failed).toEqual([]);
      expect(shown(redone)).toEqual(expect.arrayContaining(["q(a)", "q(b)"]));
      expect(shown(redone)).not.toContain("q(c)");
    });

    it("finds a step's formulas by what they are when a replay orders a goal otherwise", () => {
      const text = "forall x. p(x), q(c) |- (exists z. (p(z) * q(z))) & (exists z. (p(z) * q(z)))";
      let p = JSON.parse(linlog.start(text, "intuitionistic", S)) as Played & { opened: number[] };
      p = apply(p, 0, {
        position: at(p, 0, "(∃z. (p(z) ⊗ q(z))) & (∃z. (p(z) ⊗ q(z)))"),
        rule: "&R",
      });
      const [x, y] = p.opened as [number, number];
      // p(c) made first on the first branch, then shared by the second.
      p = apply(p, x, { position: at(p, x, "∀x. p(x)"), rule: "∀L", witness: "c" });
      p = apply(p, y, { position: at(p, y, "∃z. (p(z) ⊗ q(z))"), rule: "∃R", witness: "c" });
      let g = p.opened[0] ?? -1;
      p = apply(p, g, { position: at(p, g, "∀x. p(x)"), rule: "∀L", witness: "c" });
      g = p.opened[0] ?? -1;
      p = apply(p, g, { position: at(p, g, "p(c) ⊗ q(c)"), rule: "⊗R", left: [at(p, g, "p(c)")] });
      // Undo on the first branch: the second branch makes p(c) itself, after its ∃R's body.
      const back = retract(
        p.session,
        p.opened[0] === undefined ? x : (goalAt(p.session, [0, 0]) ?? x),
        undefined,
        p.view.cuts,
        p.view,
      );
      const after = play(linlog, started(text, "intuitionistic"), back?.kept ?? [], S);
      expect(after.failed).toEqual([]);
      expect(after.session.inferences[goalAt(after.session, [1, 0, 0]) ?? -1]?.rule).toBe("⊗R");
    });

    it("replays an open witness open, and a cut naming an eigenvariable", () => {
      const text = "forall x. (p(x) -o q(x)), forall x. p(x) |- forall y. q(y)";
      let p = JSON.parse(linlog.start(text, "intuitionistic", S)) as Played & { opened: number[] };
      p = apply(p, 0, { position: at(p, 0, "∀y. q(y)"), rule: "∀R" });
      const goal = p.opened[0] ?? -1;
      const cut = JSON.parse(
        linlog.cut(
          JSON.stringify(p.session),
          goal,
          "p(a)",
          JSON.stringify([at(p, goal, "∀x. p(x)")]),
          S,
        ),
      ) as Played & { opened: number[] };
      const [proving] = cut.opened as [number, number];
      const open = apply(cut, proving, { position: at(cut, proving, "∀x. p(x)"), rule: "∀L" });
      expect(shown(open)).toContain("p($1)");
      const all = actions(open.session, open.view.cuts, open.view);
      // The eigenvariable a by the path of the step that made it, the root's.
      expect(all.map((a) => (a.kind === "step" ? a.term : a.kind))).toEqual(["{}", "cut", null]);
      expect(all[1]).toMatchObject({ kind: "cut", formula: "p({})" });
      const again = replay(linlog, open.session, all, S);
      expect(again.failed).toEqual([]);
      same(again.session, open.session);
    });
  });
});
