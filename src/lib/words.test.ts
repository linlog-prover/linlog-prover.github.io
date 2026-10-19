// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

import { describe, expect, it } from "vitest";
import { pretty } from "./words";
import { linlog } from "./testing";

describe("the typed sequent's signs", () => {
  it("read as the same sequent as the ASCII the visitor typed", () => {
    const typed = [
      "A * B |- B * A",
      "|- (~A | A) & (~B | B)",
      "A -o B, A |- B",
      "!A |- ?A + (A * 1)",
      "|- bot, top, 0, A",
      "A&B|-B+A",
    ];
    for (const text of typed) {
      const ascii = JSON.parse(linlog.read(text, "")).sequent;
      expect(JSON.parse(linlog.read(pretty(text), "")).sequent, text).toEqual(ascii);
    }
  });
});
