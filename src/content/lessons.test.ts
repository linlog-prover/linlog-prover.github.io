// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// Learn's written lessons hold to what they claim: each worked proof is a
// problem of the store whose session applies, step by step, the rules the
// lesson gives reasons for; the faded proof and the self-explanation prompt
// fall within it; a legal split shown as a dead end is one linlog's
// split_passes refuses; a hinge question has one right answer, each wrong one
// names a misconception, and a problem it names is provable exactly when it is
// the right answer. An attempt that goes wrong is an unfinished session of the
// worked proof's sequent whose one wrong step is the first that leaves a goal
// with no proof; a search shown giving up answers unknown at its budget and
// proves its sequent with a larger one; a problem asked of linlog has no proof,
// one whose net is drawn has a net. A worked proof's cut eliminated on the stage
// reaches a cut-free proof on the derivation and on the net, each step's case
// with its reason; a problem proved with a cut has its inferences with the cut
// and without as linlog counts them; an attempt whose last step linlog refuses
// is an unfinished session of a problem with no proof. Every lesson problem is
// decided well inside the page's budget. Every rule a worked proof uses has its schema in the
// reference, two-sided where the proof is intuitionistic, and the readings a
// formula's hover gives are the reference's.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import type { SessionDoc } from "../lib/linlog";
import { actions, goalAt } from "../lib/steps";
import { linlog } from "../lib/testing";
import { READINGS } from "../lib/words";

const read = (dir: string) =>
  readdirSync(new URL(dir, import.meta.url))
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const text = readFileSync(new URL(`${dir}${name}`, import.meta.url), "utf8");
      return { id: name.slice(0, -3), data: parse(text.split("---\n")[1] ?? "") };
    });
const lessons = read("./lessons/").sort((a, b) => a.data.lesson - b.data.lesson);
const rules = read("./rules/");
const problems = new Map(read("./problems/").map((p) => [p.id, p.data]));
const session = (id: string): SessionDoc =>
  JSON.parse(readFileSync(new URL(`./problems/${id}.session.json`, import.meta.url), "utf8"));
/** The names of the rules the reference draws for a proof in `mode`: two-sided where it is intuitionistic. */
const schemas = (mode: string) =>
  new Set(
    rules
      .filter((r) => (mode.startsWith("intuitionistic") ? r.data.oneSided : r.data.twoSided))
      .map((r) => r.data.name),
  );
/** linlog's tab default, the page's work budget (`DEFAULT_BUDGET`). */
const TAB_BUDGET = 2 ** 26;
const within = (work: number) => JSON.stringify({ limits: { work } });
/** The open goals of a session, by number. */
const open = (doc: SessionDoc): number[] =>
  JSON.parse(linlog.view(JSON.stringify(doc), "")).goals.map((g: { goal: number }) => g.goal);
/** linlog's verdict on a goal, by the search within the page's budget. */
const verdictOn = (doc: SessionDoc, goal: number): string =>
  JSON.parse(linlog.close(JSON.stringify(doc), goal, within(TAB_BUDGET))).outcome.verdict;

describe("Learn's lessons", () => {
  it("are the eleven lessons of the progression, in its order", () => {
    expect(lessons.map((l) => [l.data.lesson, l.data.title])).toEqual([
      [1, "Reading a sequent"],
      [2, "The multiplicatives"],
      [3, "The additives"],
      [4, "The units"],
      [5, "The exponentials"],
      [6, "Two sides"],
      [7, "When there is no proof"],
      [8, "Proof nets"],
      [9, "Cut and its elimination"],
      [10, "The quantifiers"],
      [11, "Ordinary logic through the translations"],
    ]);
  });

  it.each(lessons)(
    "$id plays a provable store problem of its own lesson, a reason per step of its session",
    (l) => {
      const problem = problems.get(l.data.worked);
      expect(problem?.lesson).toBe(l.data.lesson);
      expect(problem?.verdict).toBe("provable");
      const doc = session(l.data.worked);
      const applied = doc.history.map((h) => doc.inferences[h]?.rule);
      expect(l.data.steps.map((s: { rule: string }) => s.rule)).toEqual(applied);
      for (const rule of applied) expect(l.data.choices).toContain(rule);
      expect(l.data.faded).toBeLessThan(applied.length);
      expect(l.data.explain.after).toBeLessThan(applied.length);
      for (const rule of applied) expect(schemas(doc.mode), `${rule}'s schema`).toContain(rule);
    },
  );

  it.each(lessons.filter((l) => l.data.detour))(
    "$id's dead end is a legal split that split_passes refuses",
    (l) => {
      const { before, left } = l.data.detour;
      const doc = session(l.data.worked);
      const all = actions(doc);
      let at = JSON.parse(linlog.start(problems.get(l.data.worked)?.sequent, doc.mode, "")).session;
      for (const action of all.slice(0, before)) {
        if (action.kind !== "step") throw new Error("a worked proof is made of steps");
        const goal = goalAt(at, action.path);
        at = JSON.parse(
          linlog.apply(JSON.stringify(at), goal ?? -1, JSON.stringify(action.step), ""),
        ).session;
      }
      const action = all[before];
      if (action?.kind !== "step") throw new Error("the dead end replaces a step");
      const goal = goalAt(at, action.path) ?? -1;
      const wrong = JSON.stringify({ ...action.step, left });
      expect(linlog.split_passes(JSON.stringify(at), goal, wrong, "")).toBe(false);
      expect(linlog.split_passes(JSON.stringify(at), goal, JSON.stringify(action.step), "")).toBe(
        true,
      );
      // Legal all the same: linlog applies it.
      expect(() => linlog.apply(JSON.stringify(at), goal, wrong, "")).not.toThrow();
    },
  );

  it.each(lessons.filter((l) => l.data.attempt))(
    "$id's attempt goes wrong at its one step without a misconception, the first that leaves a goal with no proof",
    (l) => {
      const { steps } = l.data.attempt;
      const doc: SessionDoc = JSON.parse(
        readFileSync(new URL(`./lessons/${l.id}.attempt.json`, import.meta.url), "utf8"),
      );
      const worked = session(l.data.worked);
      expect(doc.sequent).toEqual(worked.sequent);
      expect(doc.mode).toBe(worked.mode);
      expect(steps.map((s: { rule: string }) => s.rule)).toEqual(
        doc.history.map((h) => doc.inferences[h]?.rule),
      );
      const wrong = steps.findIndex((s: { misconception?: string }) => !s.misconception);
      expect(steps.filter((s: { misconception?: string }) => !s.misconception)).toHaveLength(1);
      let at: SessionDoc = JSON.parse(
        linlog.start(problems.get(l.data.worked)?.sequent, doc.mode, ""),
      ).session;
      for (const [k, action] of actions(doc).entries()) {
        if (action.kind !== "step") throw new Error("an attempt is made of steps");
        const goal = goalAt(at, action.path) ?? -1;
        at = JSON.parse(
          linlog.apply(JSON.stringify(at), goal, JSON.stringify(action.step), ""),
        ).session;
        const verdicts = open(at).map((g) => verdictOn(at, g));
        if (k < wrong) expect(verdicts, `after step ${k + 1}`).not.toContain("unprovable");
        if (k === wrong) expect(verdicts, `after step ${k + 1}`).toContain("unprovable");
      }
      // It ends stuck: a goal is still open.
      expect(open(at).length).toBeGreaterThan(0);
    },
  );

  it.each(lessons.filter((l) => l.data.unknown))(
    "$id's search answers unknown at its budget and its doublings until the text's, and proves the sequent there and at the page's",
    (l) => {
      const { sequent, mode, budget } = l.data.unknown;
      expect([...problems.values()].some((p) => p.sequent === sequent && p.mode === mode)).toBe(
        false,
      );
      const start = JSON.parse(linlog.start(sequent, mode, "")).session;
      const at = (work: number) =>
        JSON.parse(linlog.close(JSON.stringify(start), 0, within(work))).outcome.verdict;
      for (const work of [budget, 2 * budget, 4 * budget])
        expect(at(work), `${work}`).toBe("unknown");
      expect(l.data.unknown.text).toContain(`${8 * budget} units`);
      expect(at(8 * budget)).toBe("proved");
      expect(at(TAB_BUDGET)).toBe("proved");
    },
  );

  it.each(lessons.filter((l) => l.data.gallery))(
    "$id's gallery shows problems of its own: those asked of linlog have no proof, those drawn have a net",
    (l) => {
      for (const item of l.data.gallery.items) {
        const problem = problems.get(item.problem);
        expect(problem?.lesson, item.problem).toBe(l.data.lesson);
        if (l.data.gallery.act === "ask") expect(problem?.verdict, item.problem).toBe("unprovable");
        else {
          const view = JSON.parse(linlog.view(JSON.stringify(session(item.problem)), ""));
          expect(view.complete, item.problem).toBe(true);
          expect(view.net, item.problem).toBeNull();
        }
      }
    },
  );

  it.each(lessons.filter((l) => l.data.eliminate))(
    "$id's worked proof eliminates to a cut-free proof on the derivation and on the net, a reason for each step's case",
    (l) => {
      const doc = JSON.stringify(session(l.data.worked));
      for (const call of [linlog.eliminate, linlog.net_eliminate]) {
        const ran = JSON.parse(call(doc, "", ""));
        expect(ran.end, call.name).toBe("cut_free");
        expect(ran.steps.length, call.name).toBeGreaterThan(0);
        for (const step of ran.steps)
          expect(l.data.eliminate.cases, step.case).toHaveProperty(step.case);
      }
    },
  );

  it.each(lessons.filter((l) => l.data.counts))(
    "$id's problems proved with a cut have the inferences it says, with the cut and cut-free",
    (l) => {
      expect(l.data.counts.map((c: { problem: string }) => c.problem)).toContain(l.data.worked);
      for (const c of l.data.counts) {
        expect(problems.get(c.problem)?.lesson, c.problem).toBe(l.data.lesson);
        const doc = session(c.problem);
        const view = JSON.parse(linlog.view(JSON.stringify(doc), ""));
        expect(
          view.cuts.map((x: { formula: string }) => x.formula),
          c.problem,
        ).toEqual([c.formula]);
        expect(doc.inferences.filter((i) => i.rule !== undefined).length, c.problem).toBe(c.with);
        // The cut-free proof's inferences, as its drawing numbers them.
        const ran = JSON.parse(linlog.eliminate(JSON.stringify(doc), "", ""));
        expect(ran.end).toBe("cut_free");
        expect(ran.drawing.match(/id="i\d+"/g)?.length, c.problem).toBe(c.without);
        expect(c.without, c.problem).toBeGreaterThan(c.with);
      }
    },
  );

  it.each(lessons.filter((l) => l.data.refusal))(
    "$id's attempt is an unfinished session of a problem with no proof, whose last step linlog refuses",
    (l) => {
      const { problem: id, steps, refused } = l.data.refusal;
      const problem = problems.get(id);
      expect(problem?.lesson).toBe(l.data.lesson);
      expect(problem?.verdict).toBe("unprovable");
      const doc: SessionDoc = JSON.parse(
        readFileSync(new URL(`./lessons/${l.id}.refusal.json`, import.meta.url), "utf8"),
      );
      expect(doc.mode).toBe(problem?.mode);
      const start = JSON.parse(linlog.start(problem?.sequent, doc.mode, "")).session;
      expect(doc.sequent).toEqual(start.sequent);
      expect(steps.map((s: { rule: string }) => s.rule)).toEqual(
        doc.history.map((h) => doc.inferences[h]?.rule),
      );
      const [goal, ...more] = open(doc);
      expect(more).toEqual([]);
      const step = JSON.stringify({ position: refused.position, rule: refused.rule });
      expect(() => linlog.apply(JSON.stringify(doc), goal ?? -1, step, "")).toThrow(
        /eigenvariable/,
      );
    },
  );

  it.each(lessons.filter((l) => l.data.net))("$id's worked proof has a net to see", (l) => {
    const view = JSON.parse(linlog.view(JSON.stringify(session(l.data.worked)), ""));
    expect(view.net).toBeNull();
  });

  it("decides every problem of the lessons well inside the page's budget", () => {
    for (const [id, p] of problems) {
      if (p.lesson === undefined) continue;
      const sequent = JSON.parse(linlog.read(p.sequent, "")).sequent;
      const outcome = JSON.parse(
        linlog.prove(JSON.stringify(sequent), p.mode, within(TAB_BUDGET)),
      ).outcome;
      expect(outcome.verdict, id).toBe(p.verdict === "provable" ? "proved" : "unprovable");
      expect(outcome.statistics.work, id).toBeLessThan(TAB_BUDGET / 100);
    }
  });

  it.each(lessons)(
    "$id's hinge question has one right answer, and each wrong one names a misconception",
    (l) => {
      const options: { problem?: string; misconception?: string }[] = l.data.hinge.options;
      expect(options.filter((o) => !o.misconception)).toHaveLength(1);
      for (const o of options.filter((o) => o.problem)) {
        const problem = problems.get(o.problem ?? "");
        expect(problem?.lesson, o.problem).toBeDefined();
        expect(problem?.verdict === "provable", o.problem).toBe(!o.misconception);
      }
    },
  );
});

describe("the reference", () => {
  const reference = readFileSync(new URL("./texts/reference.md", import.meta.url), "utf8");

  it("draws each two-sided rule as the one-sided rule it names, which lists it among its two-sided names", () => {
    expect(reference).toContain("<div data-rules-two></div>");
    for (const r of rules.filter((r) => r.data.oneSided)) {
      const one = rules.find((o) => o.data.twoSided && o.data.name === r.data.oneSided);
      expect(one?.data.twoSided, r.id).toContain(r.data.name);
    }
  });

  it("draws a schema for every rule of the lessons, with the lesson that teaches it", () => {
    expect(reference).toContain("<div data-rules></div>");
    for (const r of rules) {
      const lesson = lessons.find((l) => l.data.lesson === r.data.lesson);
      expect(lesson, r.id).toBeDefined();
    }
  });

  it("gives each connective the reading a formula's hover gives", () => {
    const shape = (sign: string) =>
      "!?".includes(sign) ? `${sign}A` : "∀∃".includes(sign) ? `${sign}x. A` : `A ${sign} B`;
    for (const sign of ["⊗", "⅋", "⊸", "&", "⊕", "!", "?", "∀", "∃"]) {
      const row = reference.split("\n").find((line) => line.startsWith(`| \`${shape(sign)}\``));
      const cells = row
        ?.replace(/\s*\|$/, "")
        .split(" | ")
        .map((c) => c.trim().replaceAll("`", ""));
      expect(cells?.[2], sign).toBe(READINGS[sign]?.name);
      expect(cells?.[3], sign).toBe(READINGS[sign]?.reading);
    }
  });
});
