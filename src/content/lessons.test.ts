// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// Learn's written lessons hold to what they claim: each worked proof is a
// problem of the store whose session applies, step by step, the rules the
// lesson gives reasons for; the faded proof and the self-explanation prompt
// fall within it; a legal split shown as a dead end is one linlog's
// split_passes refuses; a hinge question has one right answer, each wrong one
// names a misconception, and a problem it names is provable exactly when it is
// the right answer. Every rule a worked proof uses has its schema in the
// reference, and the readings a formula's hover gives are the reference's.

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
const ruleNames = new Set(rules.flatMap((r) => [r.data.name]));

describe("Learn's lessons", () => {
  it("are lessons 1 to 5 of the progression, in its order", () => {
    expect(lessons.map((l) => [l.data.lesson, l.data.title])).toEqual([
      [1, "Reading a sequent"],
      [2, "The multiplicatives"],
      [3, "The additives"],
      [4, "The units"],
      [5, "The exponentials"],
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
      for (const rule of applied) expect(ruleNames, `${rule}'s schema`).toContain(rule);
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

  it("draws a schema for every rule of the lessons, with the lesson that teaches it", () => {
    expect(reference).toContain("<div data-rules></div>");
    for (const r of rules) {
      const lesson = lessons.find((l) => l.data.lesson === r.data.lesson);
      expect(lesson, r.id).toBeDefined();
    }
  });

  it("gives each connective the reading a formula's hover gives", () => {
    for (const sign of ["⊗", "⅋", "⊸", "&", "⊕", "!", "?"]) {
      const row = reference
        .split("\n")
        .find((line) =>
          line.startsWith(`| \`${sign === "!" || sign === "?" ? `${sign}A` : `A ${sign} B`}\``),
        );
      const cells = row
        ?.replace(/\s*\|$/, "")
        .split(" | ")
        .map((c) => c.trim().replaceAll("`", ""));
      expect(cells?.[2], sign).toBe(READINGS[sign]?.name);
      expect(cells?.[3], sign).toBe(READINGS[sign]?.reading);
    }
  });
});
