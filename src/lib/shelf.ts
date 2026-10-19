// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The open proofs, kept in the browser's storage: what autosave writes after
 * every change, and what the next visit offers to restore.
 *
 * Each proof is its session document (or, before it is started, the text
 * typed) with its name, its mode and its redo stack. Nothing syncs anywhere.
 * On a visit the page moves what the last one left to `PREVIOUS_KEY` and
 * offers it in the restore bar, while this visit's proofs are saved under
 * `SHELF_KEY`: work begun before the visitor answers the bar overwrites
 * nothing, and restoring adds the earlier proofs to the open ones.
 */

import type { Mode, SessionDoc } from "./linlog";
import type { Action } from "./steps";

/** One open proof, as stored. */
export interface StoredProof {
  readonly id: string;
  /** What the visitor typed, kept for the sequent field. */
  readonly input: string;
  readonly mode: Mode;
  /** The session, once the sequent is started. */
  readonly session: SessionDoc | null;
  /** What undo took back, the last first out, until a new step. */
  readonly redo: readonly (readonly Action[])[];
}

/** Every open proof and which one is shown. */
export interface Shelf {
  readonly version: 1;
  readonly proofs: readonly StoredProof[];
  readonly active: string | null;
}

/** The storage key of this visit's proofs. */
export const SHELF_KEY = "linlog-proofs";
/** The storage key of the last visit's, until the visitor restores or discards them. */
export const PREVIOUS_KEY = "linlog-proofs-previous";

/** The part of `Storage` the shelf uses; absent where the browser gives none. */
export type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const isProof = (p: unknown): p is StoredProof => {
  if (!p || typeof p !== "object") return false;
  const proof = p as Record<string, unknown>;
  return (
    typeof proof["id"] === "string" &&
    typeof proof["input"] === "string" &&
    typeof proof["mode"] === "string" &&
    (proof["session"] === null || typeof proof["session"] === "object") &&
    Array.isArray(proof["redo"])
  );
};

/** A shelf read from its JSON, or undefined for anything that is not one. */
export function parseShelf(text: string | null): Shelf | undefined {
  if (text === null) return undefined;
  try {
    const shelf = JSON.parse(text) as Partial<Shelf>;
    if (shelf.version !== 1 || !Array.isArray(shelf.proofs) || !shelf.proofs.every(isProof)) {
      return undefined;
    }
    const active = typeof shelf.active === "string" ? shelf.active : null;
    return { version: 1, proofs: shelf.proofs, active };
  } catch {
    return undefined;
  }
}

/**
 * At a visit's start: moves the last visit's proofs aside and returns them,
 * those already aside included, for the restore bar; undefined when there
 * are none. A storage the browser refuses reads as empty.
 */
export function setAside(store: Store | undefined): Shelf | undefined {
  if (!store) return undefined;
  try {
    const last = parseShelf(store.getItem(SHELF_KEY));
    const before = parseShelf(store.getItem(PREVIOUS_KEY));
    const proofs = [...(before?.proofs ?? []), ...(last?.proofs ?? [])].filter(
      (p, i, all) => all.findIndex((q) => q.id === p.id) === i,
    );
    store.removeItem(SHELF_KEY);
    if (proofs.length === 0) {
      store.removeItem(PREVIOUS_KEY);
      return undefined;
    }
    const aside: Shelf = { version: 1, proofs, active: last?.active ?? before?.active ?? null };
    store.setItem(PREVIOUS_KEY, JSON.stringify(aside));
    return aside;
  } catch {
    return undefined;
  }
}

/** Saves this visit's proofs; false when the browser refused (full, or storage off). */
export function saveShelf(store: Store | undefined, shelf: Shelf): boolean {
  if (!store) return false;
  try {
    store.setItem(SHELF_KEY, JSON.stringify(shelf));
    return true;
  } catch {
    return false;
  }
}

/** Forgets the last visit's proofs, restored or discarded. */
export function dropAside(store: Store | undefined): void {
  try {
    store?.removeItem(PREVIOUS_KEY);
  } catch {
    // Nothing to forget where storage is off.
  }
}
