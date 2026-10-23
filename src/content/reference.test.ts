// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// Learn's reference cites each engine by a work that states what the entry
// says. The additive path is cited by the rules it applies; Whitman's word
// problem for lattices, which no source cited here equates with it, is named
// as related and no more.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ENGINES } from "../lib/engines";

const reference = readFileSync(new URL("./texts/reference.md", import.meta.url), "utf8");
const entry = (key: string) =>
  new RegExp(`<dt id="engine-${key}">[^]*?</dd>`).exec(reference)?.[0].replace(/\s+/g, " ") ?? "";

describe("the additive path's reference", () => {
  it("cites the additive rules, and names Whitman's lattices as related alone", () => {
    const additive = entry("additive");
    expect(additive).toContain("Table 1.4");
    expect(additive.indexOf("Whitman")).toBeGreaterThan(additive.indexOf("Related:"));
    expect(additive.slice(0, additive.indexOf("Related:"))).not.toMatch(/Whitman|Day|lattice/);
    expect(ENGINES["additive"]?.source).not.toMatch(/Whitman|Day|lattice/);
  });
});
