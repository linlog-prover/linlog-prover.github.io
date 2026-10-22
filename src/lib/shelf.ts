// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The open proofs, kept in the browser's storage: what autosave writes after
 * every change, and what the next visit offers to restore.
 *
 * Each proof is its session document (or, before it is started, the text
 * typed) with its mode, its redo stack and when it was saved. Nothing syncs
 * anywhere. Every visit (a tab) saves under a key of its own, so that two
 * tabs never overwrite each other. At a visit's start the page gathers what
 * other visits left, with what earlier visits set aside, into
 * `PREVIOUS_KEY` and offers it in the restore bar; a proof saved by several
 * visits is offered as the one saved last. Work begun before the visitor
 * answers the bar overwrites nothing, and restoring adds the earlier proofs
 * to the open ones.
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
  /** The engine of each search that closed a goal, by the goal's path joined with dots. */
  readonly engines?: Readonly<Record<string, string>>;
  /** The tab and goal the proof was opened from, by the tab's id and the goal's path. */
  readonly origin?: { readonly from: string; readonly path: readonly number[] } | null;
  /** When it was saved, in milliseconds since the epoch: the later copy of a proof wins. */
  readonly saved: number;
}

/** Every open proof of a visit and which one is shown. */
export interface Shelf {
  readonly version: 1;
  readonly proofs: readonly StoredProof[];
  readonly active: string | null;
}

/** The storage keys of the visits' proofs: this prefix and the visit's id. */
export const SHELF_PREFIX = "linlog-proofs:";
/** The storage key of earlier visits' proofs, until the visitor restores or discards them. */
export const PREVIOUS_KEY = "linlog-proofs-previous";

/** The part of `Storage` the shelf uses; absent where the browser gives none. */
export type Store = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

const isProof = (p: unknown): p is StoredProof => {
  if (!p || typeof p !== "object") return false;
  const proof = p as Record<string, unknown>;
  return (
    typeof proof["id"] === "string" &&
    typeof proof["input"] === "string" &&
    typeof proof["mode"] === "string" &&
    (proof["session"] === null || typeof proof["session"] === "object") &&
    Array.isArray(proof["redo"]) &&
    typeof proof["saved"] === "number"
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
 * At a visit's start: gathers the proofs every other visit saved, with those
 * set aside before, into `PREVIOUS_KEY` and returns them for the restore bar
 * (undefined when there are none). Of several copies of one proof the one
 * saved last is kept. A storage the browser refuses reads as empty.
 */
export function setAside(store: Store | undefined, visit: string): Shelf | undefined {
  if (!store) return undefined;
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(SHELF_PREFIX) && key !== SHELF_PREFIX + visit) keys.push(key);
    }
    const shelves = [PREVIOUS_KEY, ...keys]
      .map((key) => parseShelf(store.getItem(key)))
      .filter((shelf): shelf is Shelf => shelf !== undefined);
    const newest = new Map<string, StoredProof>();
    for (const proof of shelves.flatMap((shelf) => shelf.proofs)) {
      const known = newest.get(proof.id);
      if (!known || proof.saved > known.saved) newest.set(proof.id, proof);
    }
    for (const key of keys) store.removeItem(key);
    const proofs = [...newest.values()].sort((a, b) => a.saved - b.saved);
    if (proofs.length === 0) {
      store.removeItem(PREVIOUS_KEY);
      return undefined;
    }
    const aside: Shelf = { version: 1, proofs, active: proofs.at(-1)?.id ?? null };
    store.setItem(PREVIOUS_KEY, JSON.stringify(aside));
    return aside;
  } catch {
    return undefined;
  }
}

/** Saves this visit's proofs; false when the browser refused (full, or storage off). */
export function saveShelf(store: Store | undefined, visit: string, shelf: Shelf): boolean {
  if (!store) return false;
  try {
    store.setItem(SHELF_PREFIX + visit, JSON.stringify(shelf));
    return true;
  } catch {
    return false;
  }
}

/** Keeps aside only the proofs `keep` admits (the others are open already), or forgets all. */
export function dropAside(
  store: Store | undefined,
  keep: (proof: StoredProof) => boolean = () => false,
): Shelf | undefined {
  try {
    const aside = parseShelf(store?.getItem(PREVIOUS_KEY) ?? null);
    const proofs = aside?.proofs.filter(keep) ?? [];
    if (!aside || proofs.length === 0) {
      store?.removeItem(PREVIOUS_KEY);
      return undefined;
    }
    const kept: Shelf = { ...aside, proofs };
    store?.setItem(PREVIOUS_KEY, JSON.stringify(kept));
    return kept;
  } catch {
    return undefined;
  }
}
