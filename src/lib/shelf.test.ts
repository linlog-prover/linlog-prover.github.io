// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  dropAside,
  PREVIOUS_KEY,
  parseShelf,
  SHELF_KEY,
  type Shelf,
  type Store,
  saveShelf,
  setAside,
} from "./shelf";

class Memory implements Store {
  map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

const proof = (id: string) => ({
  id,
  input: "A |- A",
  mode: "classical" as const,
  session: null,
  redo: [],
});

describe("the stored proofs", () => {
  it("reads back what it saved", () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.string(), { minLength: 1 }), (ids) => {
        const store = new Memory();
        const shelf: Shelf = { version: 1, proofs: ids.map(proof), active: ids[0] ?? null };
        expect(saveShelf(store, shelf)).toBe(true);
        expect(parseShelf(store.getItem(SHELF_KEY))).toEqual(shelf);
      }),
    );
  });

  it("refuses what is not a shelf", () => {
    expect(parseShelf("{")).toBeUndefined();
    expect(parseShelf('{"version":2,"proofs":[]}')).toBeUndefined();
    expect(parseShelf('{"version":1,"proofs":[{"id":1}]}')).toBeUndefined();
  });

  it("sets the last visit's proofs aside, so new work overwrites none of them", () => {
    const store = new Memory();
    saveShelf(store, { version: 1, proofs: [proof("a"), proof("b")], active: "b" });
    const aside = setAside(store);
    expect(aside?.proofs.map((p) => p.id)).toEqual(["a", "b"]);
    expect(store.getItem(SHELF_KEY)).toBeNull();
    saveShelf(store, { version: 1, proofs: [proof("c")], active: "c" });
    // A visit that never answered the bar: both visits' proofs are offered next time.
    expect(setAside(store)?.proofs.map((p) => p.id)).toEqual(["a", "b", "c"]);
    dropAside(store);
    expect(store.getItem(PREVIOUS_KEY)).toBeNull();
    expect(setAside(store)).toBeUndefined();
  });

  it("reads a storage that throws as empty", () => {
    const refusing: Store = {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      },
      removeItem() {
        throw new Error("denied");
      },
    };
    expect(setAside(refusing)).toBeUndefined();
    expect(saveShelf(refusing, { version: 1, proofs: [], active: null })).toBe(false);
  });
});
