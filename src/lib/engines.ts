// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * linlog's engines as the page names them: the name an outcome gives
 * (`engine`, and `classical` for the classical refuter, whose refutation an
 * outcome names by its kind), a short name for beside the work, what the
 * engine does in a line, and its source in the literature, which Learn's
 * reference lists in full with its link (src/content/texts/reference.md,
 * each engine under the id `engine-<key>`).
 */

import type { Outcome } from "./linlog";

/** One engine. */
export interface Engine {
  /** Its name beside the work it did. */
  readonly name: string;
  /** What it does, in a line. */
  readonly does: string;
  /** Its source, as the hover gives it: authors and year. */
  readonly source: string;
}

/** Every engine the page may name, in linlog's order, the classical refuter last. */
export const ENGINES: Readonly<Record<string, Engine>> = {
  focus: {
    name: "focused search",
    does: "searches backward from the goal, one focus at a time",
    source: "Andreoli 1992, focusing",
  },
  net: {
    name: "proof-net search",
    does: "links dual literals until the switching criterion accepts the net",
    source: "Girard 1987, proof nets; Danos and Regnier's criterion, as Gallier states it",
  },
  "two-sided": {
    name: "two-sided focused search",
    does: "the focused search on the intuitionistic sequent, one goal on the right",
    source: "Andreoli 1992, focusing",
  },
  additive: {
    name: "additive path",
    does: "decides two formulas of & and ⊕ by their pairs of subformulas",
    source: "Whitman's word problem for lattices, as Day 1970 gives it",
  },
  horn: {
    name: "Horn engine",
    does: "reads the goal as a Petri net and searches its markings",
    source: "Engberg and Winskel 1990, Petri nets; Abdulla et al. 1996",
  },
  essential: {
    name: "essential-net search",
    does: "links literals under the intuitionistic reading's directions",
    source: "Lamarche's essential nets, as Moot 2008 states them",
  },
  inverse: {
    name: "inverse method",
    does: "derives sequents forward from the axioms until the goal or nothing new comes",
    source: "Chaudhuri and Pfenning 2005, the focused inverse method",
  },
  classical: {
    name: "classical refuter",
    does: "finds an assignment under which the sequent read classically is false",
    source: "the Handbook of linear logic, the skeleton of a proof (Theorem 1.8.1)",
  },
};

/** linlog's engines in its own order, by the names `search.engine` takes. */
export const ENGINE_ORDER = [
  "focus",
  "net",
  "two-sided",
  "additive",
  "horn",
  "essential",
  "inverse",
] as const;

/** The engine whose work an outcome is: the classical refuter for its refutation, else the one it names. */
export function engineOf(outcome: Outcome | undefined | null): string | undefined {
  if (!outcome) return undefined;
  if (outcome.refutation?.kind === "classical") return "classical";
  return outcome.engine;
}

/** An engine's hover: its name, what it does and its source. */
export function engineTip(key: string): string {
  const engine = ENGINES[key];
  if (!engine) return `The engine ${key}`;
  return `The ${engine.name} ${engine.does}. Source: ${engine.source}; Learn's reference has it in full.`;
}

/** An engine's name standing alone, as a label: in sentence case. */
export function engineLabel(key: string): string {
  const name = engineName(key);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/** An engine's name inside a sentence. */
export function engineName(key: string): string {
  return ENGINES[key]?.name ?? key;
}
