// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

// One visual grammar from one set of tokens: the page's stylesheet names no
// raw colour, length, duration, weight, opacity or layer of its own, only the
// tokens of tokens.css; and the island sizes no icon and writes no length of
// its own. A value outside the tokens fails here, naming its place.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

/** The raw values in one declaration's value, every `var(…)` set aside. */
function raw(value: string): string[] {
  const found: string[] = [];
  const bare = value.replace(/var\(--[\w-]+\)/g, "");
  for (const colour of bare.match(
    /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/gi,
  ) ?? []) {
    found.push(colour);
  }
  // Inside calc(), a bare integer is arithmetic over tokens, not a value.
  const outsideCalc = bare.replace(/calc\(([^()]|\([^()]*\))*\)/g, (inner) =>
    inner.replace(/(?<![\w.-])-?\d+(?![\w.%])/g, ""),
  );
  for (const match of outsideCalc.matchAll(/(?<![\w.#-])(-?\d*\.?\d+)([a-z%]*)/gi)) {
    const [whole, number, unit] = match as unknown as [string, string, string];
    const n = Number(number);
    const allowed =
      n === 0 ||
      (n === 1 && (unit === "" || unit === "fr")) ||
      ((n === 100 || n === 50 || n === -50) && unit === "%") ||
      (n === 100 && (unit === "vw" || unit === "vh"));
    if (!allowed) found.push(whole);
  }
  return found;
}

/** Every declaration of a stylesheet outside at-rules' preludes, with its line. */
function declarations(text: string): { line: number; property: string; value: string }[] {
  const plain = text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
  const found = [];
  for (const match of plain.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)(?=[;}])/g)) {
    const line = plain.slice(0, match.index).split("\n").length;
    found.push({ line, property: match[1] as string, value: match[2] as string });
  }
  return found;
}

describe("the stylesheet", () => {
  it("takes every value from the tokens", () => {
    const outside = declarations(css("app.css")).flatMap(({ line, property, value }) =>
      raw(value).map((v) => `app.css:${line} ${property}: ${v}`),
    );
    expect(outside).toEqual([]);
  });

  it("finds a raw value where there is one", () => {
    expect(raw("0 var(--spacing-2) 7px")).toEqual(["7px"]);
    expect(raw("1px solid #fff")).toEqual(["#fff", "1px"]);
    expect(raw("calc(-1 * var(--line) / 2) 0.5")).toEqual(["0.5"]);
    expect(raw("translateX(-50%) minmax(0, 1fr)")).toEqual([]);
  });

  it("has a spacing scale of its own", () => {
    const steps = [...css("tokens.css").matchAll(/--spacing-[\d-]+:\s*(\d+)px/g)].map((m) =>
      Number(m[1]),
    );
    expect(steps.length).toBeGreaterThan(8);
    expect(steps.slice(0, -1).every((step, i) => step <= (steps[i + 1] as number))).toBe(true);
  });
});

/** A media query's width: the one breakpoint, the same in every stylesheet and in the island. */
const MEDIA = /\(max-width: (\d+)px\)/g;

describe("the phone's breakpoint", () => {
  it("is one width everywhere", () => {
    const dir = new URL("../islands/", import.meta.url);
    const sources = [
      css("app.css"),
      css("tokens.css"),
      ...readdirSync(dir).map((name) => readFileSync(new URL(name, dir), "utf8")),
    ];
    const widths = new Set(sources.flatMap((text) => [...text.matchAll(MEDIA)].map((m) => m[1])));
    expect([...widths]).toEqual(["640"]);
  });
});

describe("the island", () => {
  it("sizes no icon and writes no length of its own", () => {
    const dir = new URL("../islands/", import.meta.url);
    const outside = readdirSync(dir)
      .filter((name) => name.endsWith(".tsx"))
      .flatMap((name) =>
        readFileSync(new URL(name, dir), "utf8")
          .split("\n")
          .flatMap((text, i) =>
            /\bsize=\{|["'`][^"'`\n]*\b\d+(\.\d+)?px\b/.test(text.replace(MEDIA, ""))
              ? [`${name}:${i + 1} ${text.trim()}`]
              : [],
          ),
      );
    expect(outside).toEqual([]);
  });
});
