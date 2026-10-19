// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Offered, Played, SessionDoc } from "./linlog";
import { actions, goalAt, paths, replay, retract, searchMade } from "./steps";
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
    ];
    fc.assert(
      fc.property(
        fc.constantFrom(...sequents),
        fc.array(fc.nat(1000), { minLength: 1, maxLength: 12 }),
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
      { numRuns: 60 },
    );
  });
});
