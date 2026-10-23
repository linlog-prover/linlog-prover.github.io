// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * Practice: a place of its own, opened from the bottom band, with the
 * store's provable problems, filtered by category and level, one at random
 * within the filters, each opening as a proof on a new tab. The browser
 * keeps the filters and which problems the visitor has proved (a problem is
 * proved when the tab it opened on finishes its proof with no goal closed by
 * the search).
 */

import { CircleCheck, Dice5 } from "lucide-solid";
import { createEffect, createResource, createSignal, For, Show } from "solid-js";
import type { Problem } from "../lib/content";
import {
  type Filters,
  GROUPS,
  LEVEL_NAMES,
  loadKept,
  NO_FILTERS,
  passes,
  pick,
  saveKept,
} from "../lib/practice";
import { displayed } from "../lib/words";
import { Stairs, Written } from "./Learn";
import type { Prover } from "./state";
import type { Ui } from "./ui";

const storage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const keyOf = (mode: string, sequent: string) => `${mode}\n${sequent.trim()}`;

/** Practice's state, for the island's life: the problems once asked for, the filters, the problems proved. */
export function createPractice(prover: Prover) {
  const [wanted, setWanted] = createSignal(false);
  const [problems] = createResource(wanted, async () => {
    const response = await fetch("/problems.json");
    if (!response.ok) throw new Error(`${response.status}`);
    return (await response.json()) as Problem[];
  });
  const [kept, setKept] = createSignal(loadKept(storage()));
  const keep = (change: Partial<{ filters: Filters; proved: readonly string[] }>) => {
    setKept({ ...kept(), ...change });
    saveKept(storage(), kept());
  };

  /** The problem each tab opened from Practice holds, by the tab's proof's id. */
  const opened = new Map<string, Problem>();

  // A problem is proved when its tab finishes the proof of its sequent in its calculus
  // by the visitor's own steps: a goal the search closed (Close, Close all) is in `engines`.
  createEffect(() => {
    const proved = new Set(kept().proved);
    let added = false;
    for (const proof of prover.store.proofs) {
      if (!proof.view?.complete || Object.keys(proof.engines).length > 0) continue;
      const problem = opened.get(proof.id);
      if (!problem || keyOf(problem.mode, problem.sequent) !== keyOf(proof.mode, proof.input))
        continue;
      const id = problem.id;
      if (!proved.has(id)) {
        proved.add(id);
        added = true;
      }
    }
    if (added) keep({ proved: [...proved] });
  });

  return {
    /** Asks for the problems, once. */
    want: () => setWanted(true),
    /** Notes that a tab's proof holds a problem opened from Practice. */
    opened: (proof: string, problem: Problem) => opened.set(proof, problem),
    problems,
    kept,
    keep,
  };
}

/** Practice's state's type. */
export type Practice = ReturnType<typeof createPractice>;

export function PracticePlace(props: { prover: Prover; ui: Ui; practice: Practice }) {
  const { setUi } = props.ui;
  props.practice.want();
  const filters = () => props.practice.kept().filters;
  const all = () => props.practice.problems() ?? [];
  const shown = () => all().filter((p) => passes(p, filters()));
  const proved = () => new Set(props.practice.kept().proved);
  const toggle = <T,>(list: readonly T[], item: T) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  const open = async (problem: Problem) => {
    setUi("menu", null);
    await props.prover.example(
      { sequent: problem.sequent, mode: problem.mode, session: null },
      false,
    );
    const tab = props.prover.current();
    if (tab) props.practice.opened(tab.id, problem);
    setUi("live", `${displayed(problem.sequent)}: opened on a new tab.`);
  };

  return (
    <div class="cluster menu practice" role="dialog" aria-label="Practice">
      <div class="pr-head">
        <h2 class="pr-title">Practice</h2>
        <Show when={props.practice.problems()}>
          <span class="sub" aria-live="polite">
            {shown().length} of {all().length} problems
          </span>
        </Show>
        <span class="grow" />
        <button
          type="button"
          class="btn btn-primary"
          disabled={shown().length === 0 || props.prover.busy()}
          data-tip="One of the problems the filters show, on a new tab"
          onClick={() => {
            const chosen = pick(shown(), Math.random);
            if (chosen) void open(chosen);
          }}
        >
          <Dice5 aria-hidden="true" />A random problem
        </button>
      </div>
      <Written name="texts/practice" class="sub pr-intro" />
      <div class="pr-filters">
        <For each={GROUPS}>
          {(group) => (
            <fieldset class="pr-group">
              <legend class="kw-label">{group.name}</legend>
              <For each={group.categories}>
                {([key, label]) => (
                  <label class="chip">
                    <input
                      type="checkbox"
                      checked={filters().categories.includes(key)}
                      onChange={() =>
                        props.practice.keep({
                          filters: { ...filters(), categories: toggle(filters().categories, key) },
                        })
                      }
                    />
                    {label}
                  </label>
                )}
              </For>
            </fieldset>
          )}
        </For>
        <fieldset class="pr-group">
          <legend class="kw-label">Difficulty</legend>
          <For each={[1, 2, 3, 4] as const}>
            {(level) => (
              <label class="chip">
                <input
                  type="checkbox"
                  checked={filters().levels.includes(level)}
                  onChange={() =>
                    props.practice.keep({
                      filters: { ...filters(), levels: toggle(filters().levels, level) },
                    })
                  }
                />
                <Stairs level={level} />
                {LEVEL_NAMES[level]}
              </label>
            )}
          </For>
        </fieldset>
        <button
          type="button"
          class="btn btn-s"
          disabled={filters().categories.length === 0 && filters().levels.length === 0}
          onClick={() => props.practice.keep({ filters: NO_FILTERS })}
        >
          Show every problem
        </button>
      </div>
      <Show when={props.practice.problems.error}>
        <p class="kw bad">The problems did not load; open Practice again to retry.</p>
      </Show>
      <Show when={props.practice.problems.loading}>
        <p class="sub">Loading the problems…</p>
      </Show>
      <Show when={props.practice.problems() && shown().length === 0}>
        <p class="sub">No problem passes these filters: choose fewer, or show every problem.</p>
      </Show>
      <ul class="pr-list">
        <For each={shown()}>
          {(problem) => (
            <li class="pr-row" data-problem={problem.id}>
              <button
                type="button"
                class="pr-item"
                disabled={props.prover.busy()}
                aria-label={`Prove ${displayed(problem.sequent)}, ${LEVEL_NAMES[problem.level]}${proved().has(problem.id) ? ", proved before" : ""}`}
                onClick={() => void open(problem)}
              >
                <span class="m pr-seq">{displayed(problem.sequent)}</span>
                <span class="pr-meta">
                  <Stairs level={problem.level} />
                  <span>{LEVEL_NAMES[problem.level]}</span>
                  <span class="pr-frag">{problem.fragment}</span>
                  <Show when={proved().has(problem.id)}>
                    <span class="kw ok pr-done">
                      <CircleCheck aria-hidden="true" />
                      Proved
                    </span>
                  </Show>
                </span>
              </button>
              <Show when={problem.source}>
                {(source) => (
                  <p class="pr-source sub">
                    <Show when={problem.title}>{(title) => <span>{title()}: </span>}</Show>
                    <a href={source().url} rel="noopener" target="_blank">
                      {source().text}
                    </a>
                  </p>
                )}
              </Show>
            </li>
          )}
        </For>
      </ul>
      <Written name="licence" class="frame-licence" />
    </div>
  );
}
