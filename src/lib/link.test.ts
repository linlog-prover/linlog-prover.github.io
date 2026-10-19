// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  fromBase64url,
  LINK_LIMIT,
  readLink,
  toBase64url,
  UNPACKED_LIMIT,
  writeLink,
} from "./link";

describe("the link's codec", () => {
  it("reads back what it wrote: the sequent, the mode and the session", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ unit: "grapheme" }),
        fc.string(),
        fc.option(fc.json()),
        async (sequent, mode, session) => {
          const written = await writeLink(
            sequent,
            mode,
            session ?? undefined,
            Number.POSITIVE_INFINITY,
          );
          expect(written.whole).toBe(true);
          const read = await readLink(written.hash);
          expect(read).toEqual(session === null ? { sequent, mode } : { sequent, mode, session });
        },
      ),
    );
  });

  it("keeps the sequent readable in the fragment", async () => {
    const { hash } = await writeLink("A ⊗ B ⊢ B ⊗ A", "classical");
    expect(decodeURIComponent(hash)).toContain("A+⊗+B+⊢+B+⊗+A");
  });

  it("drops the session past the limit and says so", async () => {
    // A linear congruential sequence: text that deflate cannot shrink much.
    let state = 1;
    const random = Array.from({ length: 4000 }, () => {
      state = (state * 1103515245 + 12345) % 2 ** 31;
      return String.fromCharCode(33 + (state % 90));
    }).join("");
    const written = await writeLink("A |- A", "classical", JSON.stringify({ noise: random }));
    expect(written.whole).toBe(false);
    expect(written.hash.length).toBeLessThanOrEqual(LINK_LIMIT);
    expect(await readLink(written.hash)).toEqual({ sequent: "A |- A", mode: "classical" });
  });

  it("says when a session does not unpack, or the version is unknown, and keeps the sequent", async () => {
    expect(await readLink("#v=1&m=classical&s=A&d=@@@")).toEqual({
      sequent: "A",
      mode: "classical",
      problem: "document",
    });
    expect(await readLink("#v=1&m=classical&s=A&d=AAAA")).toMatchObject({ problem: "document" });
    expect(await readLink("#v=9&m=mix&s=A")).toEqual({
      sequent: "A",
      mode: "mix",
      problem: "version",
    });
    expect(await readLink("#about")).toBeUndefined();
  });

  it("refuses a session that unpacks past the cap, and keeps the sequent", async () => {
    // Eight times the cap of one repeated character: a few kilobytes deflated.
    const bomb = JSON.stringify({ pad: "a".repeat(8 * UNPACKED_LIMIT) });
    const written = await writeLink("A |- A", "classical", bomb, Number.POSITIVE_INFINITY);
    expect(written.hash.length).toBeLessThan(UNPACKED_LIMIT / 16);
    expect(await readLink(written.hash)).toEqual({
      sequent: "A |- A",
      mode: "classical",
      problem: "size",
    });
    // At the cap itself it still reads.
    const fits = JSON.stringify({ pad: "a".repeat(UNPACKED_LIMIT - 10) });
    expect(fits.length).toBe(UNPACKED_LIMIT);
    const read = await readLink((await writeLink("A", "mix", fits, Infinity)).hash);
    expect(read?.session).toBe(fits);
  });

  it("encodes bytes as base64url and back", () => {
    fc.assert(
      fc.property(fc.uint8Array(), (bytes) => {
        expect(fromBase64url(toBase64url(bytes))).toEqual(bytes);
      }),
    );
  });
});
