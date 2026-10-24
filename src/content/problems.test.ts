// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// The store of problems is what it says: linlog decides each sequent in its
// mode as its `verdict` says and detects its `fragment`, a provable one's
// session (as `linlog interact` saved it) is a finished proof of that very
// sequent in that mode, which linlog's module reads and checks, and its
// categories are the connectives it uses and its logic. Learn's lessons mix
// provable and unprovable problems and end with harder ones.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { linlog } from "../lib/testing";

const here = new URL("./problems/", import.meta.url);
const entries = readdirSync(here)
  .filter((name) => name.endsWith(".md"))
  .map((name) => {
    const text = readFileSync(new URL(name, here), "utf8");
    const field = (key: string) => new RegExp(`^${key}: "?(.*?)"?$`, "m").exec(text)?.[1];
    return {
      id: name.slice(0, -3),
      sequent: field("sequent") ?? "",
      mode: field("mode") ?? "",
      verdict: field("verdict") ?? "",
      level: Number(field("level")),
      categories: (field("categories") ?? "").replace(/^\[|\]$/g, "").split(", "),
      fragment: field("fragment") ?? "",
      lesson: field("lesson") === undefined ? null : Number(field("lesson")),
      order: Number(field("order")),
      source: field("source"),
    };
  });
const provable = entries.filter((e) => e.verdict === "provable");
const lessons = [...new Set(entries.flatMap((e) => (e.lesson === null ? [] : [e.lesson])))];

/** The categories a sequent's text and mode put it under. */
function categoriesOf(sequent: string, mode: string): string[] {
  const s = sequent.replace(/\btop\b/g, "⊤").replace(/\bbot\b/g, "⊥");
  return [
    ...(/\*|-o|\|(?!-)/.test(s) ? ["multiplicatives"] : []),
    ...(/&|\+/.test(s) ? ["additives"] : []),
    ...(/\b[10]\b|⊤|⊥/.test(s) ? ["units"] : []),
    ...(/[!?]/.test(s) ? ["exponentials"] : []),
    mode.startsWith("intuitionistic") ? "intuitionistic" : "classical",
    ...(mode.includes("affine") || mode.includes("mix") ? ["structural"] : []),
  ];
}

describe("the store of problems", () => {
  it("holds at least 300 provable problems, at every level and in every fragment the page proves in", () => {
    expect(provable.length).toBeGreaterThanOrEqual(300);
    expect(new Set(provable.map((e) => e.level))).toEqual(new Set([1, 2, 3, 4]));
    const fragments = new Set(provable.map((e) => e.fragment));
    for (const name of ["MLL", "MLL with units", "ALL", "MALL", "MELL", "LL"]) {
      expect(fragments, name).toContain(name);
      expect(fragments, `I${name}`).toContain(`I${name}`);
    }
  });

  it("writes no sequent twice in one calculus", () => {
    const seen = new Set(entries.map((e) => `${e.mode} ${e.sequent}`));
    expect(seen.size).toBe(entries.length);
  });

  it("files every problem under the connectives it uses and its logic, and under the literature when it cites a source", () => {
    for (const e of entries) {
      expect(e.categories.includes("literature"), e.id).toBe(e.source !== undefined);
      expect(
        e.categories.filter((c) => c !== "literature"),
        e.id,
      ).toEqual(categoriesOf(e.sequent, e.mode));
    }
  });

  it("mixes provable and unprovable sequents within every lesson, never three alike in a row", () => {
    for (const lesson of lessons) {
      const verdicts = entries
        .filter((e) => e.lesson === lesson)
        .sort((a, b) => a.order - b.order)
        .map((e) => e.verdict);
      expect(new Set(verdicts).size, `lesson ${lesson}`).toBe(2);
      const runs = verdicts.filter((v, i) => v === verdicts[i + 1] && v === verdicts[i + 2]);
      expect(runs, `lesson ${lesson}`).toEqual([]);
    }
  });

  it("gives every lesson from the second at least two provable problems at level 3 or above", () => {
    for (const lesson of lessons.filter((l) => l >= 2)) {
      const hard = entries.filter(
        (e) => e.lesson === lesson && e.verdict === "provable" && e.level >= 3,
      );
      expect(hard.length, `lesson ${lesson}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("writes every intuitionistic problem in its own syntax, which linlog's strict reading takes back from its print", () => {
    const intuitionistic = entries.filter((e) => e.mode.startsWith("intuitionistic"));
    expect(intuitionistic.length).toBeGreaterThan(100);
    for (const e of intuitionistic) {
      const read = JSON.parse(linlog.read_as(e.sequent, e.mode, ""));
      expect(read.sequent, e.id).toEqual(JSON.parse(linlog.read(e.sequent, "")).sequent);
      const again = JSON.parse(linlog.read_as(read.text, e.mode, ""));
      expect(again.sequent, `${e.id}: ${read.text}`).toEqual(read.sequent);
    }
    // A sequent written classically is refused there, with what to write instead.
    expect(() => linlog.read_as("~(A * ~B), A |- B", "intuitionistic", "")).toThrow(/negation/);
  });

  for (const problem of entries) {
    it(`${problem.id}: linlog says ${problem.verdict} in ${problem.fragment}, and its session proves it`, () => {
      const sequent = JSON.parse(linlog.read(problem.sequent, "")).sequent;
      const outcome = JSON.parse(linlog.prove(JSON.stringify(sequent), problem.mode, "")).outcome;
      expect(outcome.verdict).toBe(problem.verdict === "provable" ? "proved" : "unprovable");
      expect(outcome.fragment).toBe(problem.fragment);
      if (problem.verdict === "unprovable") {
        expect(readdirSync(here)).not.toContain(`${problem.id}.session.json`);
        return;
      }
      const file = new URL(`${problem.id}.session.json`, here);
      const read = JSON.parse(linlog.read(readFileSync(file, "utf8"), ""));
      expect(read.kind).toBe("session");
      expect(read.session.mode).toBe(problem.mode);
      expect(read.sequent).toEqual(sequent);
      const view = JSON.parse(linlog.view(JSON.stringify(read.session), ""));
      expect(view.complete).toBe(true);
      // The proof checks.
      expect(() => linlog.proof(JSON.stringify(read.session), "")).not.toThrow();
    });
  }
});
