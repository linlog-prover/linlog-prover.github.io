// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lucideProblems, type Manifest, meetsCaret } from "./lucide";

const read = (path: string): Manifest =>
  JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));
const site = read("package.json");
const lucide = read("node_modules/lucide-solid/package.json");
const solid = read("node_modules/solid-js/package.json");

describe("the check of Lucide", () => {
  it("passes the installed packages", () => {
    expect(lucideProblems(site, lucide, solid)).toEqual([]);
  });

  it("fails another version, another licence, no Solid source, or a Solid out of range", () => {
    expect(lucideProblems(site, { ...lucide, version: "1.51.0" }, solid)).toHaveLength(1);
    expect(lucideProblems(site, { ...lucide, license: "MIT" }, solid)).toHaveLength(1);
    expect(lucideProblems(site, { ...lucide, exports: { ".": {} } }, solid)).toHaveLength(1);
    expect(lucideProblems(site, lucide, { ...solid, version: "2.0.0" })).toHaveLength(1);
  });

  it("reads a caret range as npm does", () => {
    expect(meetsCaret("1.9.17", "^1.4.7")).toBe(true);
    expect(meetsCaret("1.4.7", "^1.4.7")).toBe(true);
    expect(meetsCaret("1.4.6", "^1.4.7")).toBe(false);
    expect(meetsCaret("2.0.0", "^1.4.7")).toBe(false);
  });
});
