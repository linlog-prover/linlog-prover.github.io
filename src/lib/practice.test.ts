// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadKept, NO_FILTERS, offered, PRACTICE_KEY, passes, pick, type Stored } from "./practice";

const stored = (id: string, data: Partial<Stored["data"]>): Stored => ({
  id,
  data: {
    sequent: "A |- A",
    mode: "classical",
    verdict: "provable",
    level: 1,
    categories: ["classical"],
    fragment: "MLL",
    ...data,
  },
});

const store = [
  stored("easy-mll", { categories: ["multiplicatives", "classical"] }),
  stored("hard-additive", { level: 3, categories: ["additives", "intuitionistic"] }),
  stored("hard-exp", {
    level: 3,
    categories: ["multiplicatives", "exponentials", "classical", "literature"],
  }),
  stored("no-proof", { verdict: "unprovable", categories: ["multiplicatives", "classical"] }),
];

describe("Practice", () => {
  it("offers the provable problems alone, easiest first", () => {
    expect(offered(store).map((p) => p.id)).toEqual(["easy-mll", "hard-additive", "hard-exp"]);
  });

  it("offers every provable problem of the store and none of its unprovable ones", () => {
    const here = new URL("../content/problems/", import.meta.url);
    const entries = readdirSync(here)
      .filter((name) => name.endsWith(".md"))
      .map((name) => {
        const text = readFileSync(new URL(name, here), "utf8");
        const verdict = /^verdict: "?(\w+)/m.exec(text)?.[1] as Stored["data"]["verdict"];
        return stored(name.slice(0, -3), { verdict });
      });
    const provable = entries.filter((e) => e.data.verdict === "provable").map((e) => e.id);
    expect(entries.length).toBeGreaterThan(provable.length);
    expect(
      offered(entries)
        .map((p) => p.id)
        .sort(),
    ).toEqual(provable.sort());
  });

  it("filters by category, any chosen within a group and every group at once, and by level", () => {
    const all = offered(store);
    const ids = (categories: string[], levels: (1 | 2 | 3 | 4)[] = []) =>
      all.filter((p) => passes(p, { categories, levels })).map((p) => p.id);
    expect(ids([])).toEqual(["easy-mll", "hard-additive", "hard-exp"]);
    expect(ids(["additives", "exponentials"])).toEqual(["hard-additive", "hard-exp"]);
    expect(ids(["multiplicatives", "intuitionistic"])).toEqual([]);
    expect(ids(["multiplicatives", "classical"], [3])).toEqual(["hard-exp"]);
    expect(ids(["literature"])).toEqual(["hard-exp"]);
    expect(ids([], [1, 3])).toEqual(["easy-mll", "hard-additive", "hard-exp"]);
  });

  it("picks a random problem among those the filters pass, and none from none", () => {
    const shown = offered(store).filter((p) => passes(p, { categories: [], levels: [3] }));
    for (const r of [0, 0.49, 0.5, 0.999]) expect(shown).toContain(pick(shown, () => r));
    expect(pick(shown, () => 0)?.id).toBe("hard-additive");
    expect(pick(shown, () => 0.999)?.id).toBe("hard-exp");
    expect(pick([], () => 0.5)).toBeNull();
  });

  it("reads back what the browser kept, and nothing from a broken entry", () => {
    const kept = { filters: { categories: ["units"], levels: [2] }, proved: ["g001"] };
    expect(
      loadKept({ getItem: (k) => (k === PRACTICE_KEY ? JSON.stringify(kept) : null) }),
    ).toEqual(kept);
    expect(loadKept({ getItem: () => "{" })).toEqual({ filters: NO_FILTERS, proved: [] });
    expect(loadKept(null)).toEqual({ filters: NO_FILTERS, proved: [] });
  });
});
