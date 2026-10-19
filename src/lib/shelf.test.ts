// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  dropAside,
  PREVIOUS_KEY,
  parseShelf,
  SHELF_PREFIX,
  type Shelf,
  type Store,
  saveShelf,
  setAside,
  type StoredProof,
} from "./shelf";

class Memory implements Store {
  map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
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

const proof = (id: string, saved = 1, input = "A |- A"): StoredProof => ({
  id,
  input,
  mode: "classical",
  session: null,
  redo: [],
  saved,
});
const shelf = (...proofs: StoredProof[]): Shelf => ({
  version: 1,
  proofs,
  active: proofs[0]?.id ?? null,
});

describe("the stored proofs", () => {
  it("reads back what it saved", () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.string(), { minLength: 1 }), (ids) => {
        const store = new Memory();
        const saved = shelf(...ids.map((id) => proof(id)));
        expect(saveShelf(store, "v", saved)).toBe(true);
        expect(parseShelf(store.getItem(`${SHELF_PREFIX}v`))).toEqual(saved);
      }),
    );
  });

  it("refuses what is not a shelf", () => {
    expect(parseShelf("{")).toBeUndefined();
    expect(parseShelf('{"version":2,"proofs":[]}')).toBeUndefined();
    expect(parseShelf('{"version":1,"proofs":[{"id":1}]}')).toBeUndefined();
  });

  it("gathers what other visits left, so new work overwrites none of it", () => {
    const store = new Memory();
    saveShelf(store, "first", shelf(proof("a"), proof("b")));
    expect(setAside(store, "second")?.proofs.map((p) => p.id)).toEqual(["a", "b"]);
    expect(store.getItem(`${SHELF_PREFIX}first`)).toBeNull();
    saveShelf(store, "second", shelf(proof("c", 2)));
    // A visit that never answered the bar: both visits' proofs are offered next time.
    expect(setAside(store, "third")?.proofs.map((p) => p.id)).toEqual(["a", "b", "c"]);
    dropAside(store);
    expect(store.getItem(PREVIOUS_KEY)).toBeNull();
    expect(setAside(store, "fourth")).toBeUndefined();
  });

  it("keeps the copy of a proof saved last, whichever visit saved it", () => {
    const store = new Memory();
    // Tab A saves p at one step; tab B opens and sets it aside; tab A goes on.
    saveShelf(store, "A", shelf(proof("p", 1, "one step")));
    setAside(store, "B");
    saveShelf(store, "A", shelf(proof("p", 5, "five steps")));
    expect(setAside(store, "C")?.proofs).toEqual([proof("p", 5, "five steps")]);
  });

  it("keeps two visits from overwriting each other", () => {
    const store = new Memory();
    saveShelf(store, "A", shelf(proof("a")));
    saveShelf(store, "B", shelf(proof("b")));
    expect(
      setAside(store, "C")
        ?.proofs.map((p) => p.id)
        .sort(),
    ).toEqual(["a", "b"]);
  });

  it("takes out of the bar what is open already", () => {
    const store = new Memory();
    saveShelf(store, "A", shelf(proof("a", 1, "A |- A"), proof("b", 1, "B |- B")));
    setAside(store, "B");
    expect(dropAside(store, (p) => p.input !== "A |- A")?.proofs.map((p) => p.id)).toEqual(["b"]);
    expect(dropAside(store, () => false)).toBeUndefined();
  });

  it("reads a storage that throws as empty", () => {
    const refusing: Store = {
      length: 0,
      key() {
        throw new Error("denied");
      },
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
    expect(setAside(refusing, "v")).toBeUndefined();
    expect(saveShelf(refusing, "v", shelf())).toBe(false);
  });
});
