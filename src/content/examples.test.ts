// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// Every example of Learn's practice is what it says: linlog decides its
// sequent in its mode as its `verdict` says, and a provable one's session
// (as `linlog interact` saved it) is a finished proof of that very sequent
// in that mode, which linlog's module reads and checks.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { linlog } from "../lib/testing";

const here = new URL("./examples/", import.meta.url);
const entries = readdirSync(here)
  .filter((name) => name.endsWith(".md"))
  .map((name) => {
    const text = readFileSync(new URL(name, here), "utf8");
    const field = (key: string) => new RegExp(`^${key}: "?(.*?)"?$`, "m").exec(text)?.[1] ?? "";
    return {
      id: name.slice(0, -3),
      sequent: field("sequent"),
      mode: field("mode"),
      verdict: field("verdict"),
    };
  });

describe("the examples", () => {
  it("are there", () => {
    expect(entries.length).toBeGreaterThan(5);
  });

  for (const example of entries) {
    it(`${example.id}: linlog says ${example.verdict}, and its session proves it`, () => {
      const sequent = JSON.parse(linlog.read(example.sequent, "")).sequent;
      const outcome = JSON.parse(linlog.prove(JSON.stringify(sequent), example.mode, "")).outcome;
      expect(outcome.verdict).toBe(example.verdict === "provable" ? "proved" : "unprovable");
      const file = new URL(`${example.id}.session.json`, here);
      if (example.verdict === "unprovable") {
        expect(readdirSync(here)).not.toContain(`${example.id}.session.json`);
        return;
      }
      const read = JSON.parse(linlog.read(readFileSync(file, "utf8"), ""));
      expect(read.kind).toBe("session");
      expect(read.session.mode).toBe(example.mode);
      expect(read.sequent).toEqual(sequent);
      const view = JSON.parse(linlog.view(JSON.stringify(read.session), ""));
      expect(view.complete).toBe(true);
      // The proof checks.
      expect(() => linlog.proof(JSON.stringify(read.session), "")).not.toThrow();
    });
  }
});
