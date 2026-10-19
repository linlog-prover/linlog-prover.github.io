// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The prover's state and every action on it: the open proofs (each its
 * session document, mode, redo stack and the note at a goal), the settings,
 * and the calls to linlog through the worker. The components read the store
 * and call these actions; nothing else changes it.
 */

import { batch, createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { type Api, createApi } from "../lib/api";
import {
  failure,
  type Failure,
  type Mode,
  type Outcome,
  type Played,
  type SessionDoc,
  type StepForm,
  type View,
} from "../lib/linlog";
import type { Example } from "../lib/content";
import { Cancelled } from "../lib/protocol";
import {
  type Shelf,
  type StoredProof,
  dropAside,
  saveShelf,
  setAside,
  type Store,
} from "../lib/shelf";
import {
  type Action,
  actions as actionsOf,
  goalAt,
  paths,
  type Path,
  retract,
  within,
} from "../lib/steps";
import { inputProblem, refusal, type Said, type Tone, verdict } from "../lib/words";

/** A note at a goal: a refusal, or what a search answered there. */
export interface Note {
  readonly path: Path;
  readonly said: Said;
  readonly tone: Tone;
  /** A search's outcome, for its certificate or a retry with a larger budget. */
  readonly outcome?: Outcome;
  /** The budget the search had, for "Try with twice the budget". */
  readonly budget?: number;
}

/** One open proof. */
export interface Proof {
  readonly id: string;
  /** The sequent field's text. */
  input: string;
  mode: Mode;
  session: SessionDoc | null;
  view: View | null;
  redo: Action[][];
  /** Whether the tab shows the sequent field. */
  editing: boolean;
  /** Why the field's text was not started, with the place to mark. */
  inputProblem: (Said & { readonly span?: { start: number; end: number } }) | null;
  /** The goal worked on, by its path (paths survive replays, numbers do not). */
  active: Path | null;
  note: Note | null;
  /** The whole sequent's verdict, when a search on its root or every goal said one. */
  verdict: (Said & { tone: Tone; outcome?: Outcome }) | null;
  /** The fragment of the text being typed, as linlog detects it, before it is started. */
  typed: { classical: string; intuitionistic: string } | null;
  /** A line on the stage that is no goal's: a proof the link could not restore. */
  banner: Said | null;
}

/** The visitor's settings, kept in the browser. */
export interface Settings {
  /** The search's work budget per call, `limits.work`. */
  budget: number;
  /** Whether the actions print their keys beside their names. */
  showKeys: boolean;
}

/** The tab's default work budget: linlog's tab default, about a second of search. */
export const DEFAULT_BUDGET = 2 ** 26;
const SETTINGS_KEY = "linlog-settings";

const storage = (): Store | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

function loadSettings(): Settings {
  try {
    const stored = JSON.parse(storage()?.getItem(SETTINGS_KEY) ?? "{}") as Partial<Settings>;
    return {
      budget:
        typeof stored.budget === "number" && stored.budget > 0 ? stored.budget : DEFAULT_BUDGET,
      showKeys: stored.showKeys === true,
    };
  } catch {
    return { budget: DEFAULT_BUDGET, showKeys: false };
  }
}

let counter = 0;
const freshId = () => `p${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Whether an open proof is a stored one: the same session, or the same text not started. */
const isOpen = (open: Proof, stored: StoredProof) =>
  open.session
    ? JSON.stringify(open.session) === JSON.stringify(stored.session)
    : !stored.session && open.input.trim() !== "" && open.input === stored.input;

const blank = (mode: Mode): Proof => ({
  id: freshId(),
  input: "",
  mode,
  session: null,
  view: null,
  redo: [],
  editing: true,
  inputProblem: null,
  active: null,
  note: null,
  verdict: null,
  typed: null,
  banner: null,
});

/** The prover's state and actions, for one island. */
export type Prover = ReturnType<typeof createProver>;

/** Creates the state, its worker and its actions. */
export function createProver() {
  const [pending, setPending] = createSignal(0);
  const api: Api = createApi(setPending);
  const [store, setStore] = createStore<{ proofs: Proof[]; active: string | null }>({
    proofs: [],
    active: null,
  });
  const [settings, setSettingsSignal] = createSignal<Settings>(loadSettings());
  const [aside, setAsideShelf] = createSignal<Shelf | undefined>(undefined);
  const [lastMode, setLastMode] = createSignal<Mode>("classical");
  const [busy, setBusy] = createSignal(false);
  /** This visit's key among the stored proofs. */
  const visit = freshId();

  /**
   * One action that changes a proof at a time: each reads the session before
   * it waits on the worker and shows the answer after, so a second one begun
   * meanwhile would build on the session the first replaces, and one answer
   * would overwrite the other. An action asked for while another runs does
   * nothing (and answers undefined); its buttons and keys wait on `busy`.
   */
  const guard =
    <A extends unknown[], R>(run: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R | undefined> => {
      if (busy()) return undefined;
      setBusy(true);
      try {
        return await run(...args);
      } finally {
        setBusy(false);
      }
    };

  /** The settings as linlog reads them: the tab's defaults with the budget. */
  const json = (budget = settings().budget) => JSON.stringify({ limits: { work: budget } });

  const current = () => store.proofs.find((p) => p.id === store.active);
  const index = (id: string) => store.proofs.findIndex((p) => p.id === id);

  const update = (id: string, change: (p: Proof) => void) => {
    const at = index(id);
    if (at >= 0) setStore("proofs", at, produce(change));
  };

  /** The goal the actions act on: the active one if still open, else the first open one. */
  const activeGoal = (p: Proof | undefined = current()): number | undefined => {
    if (!p?.session || !p.view) return undefined;
    const open = p.view.goals.map((g) => g.goal);
    const at = p.active ? goalAt(p.session, p.active) : undefined;
    return at !== undefined && open.includes(at) ? at : open[0];
  };

  const pathOf = (p: Proof, goal: number): Path =>
    p.session ? (paths(p.session).get(goal) ?? []) : [];

  /** Shows a played session, the active goal moved to `goal` (or kept where it is still open). */
  const show = (id: string, played: Played, goal?: number) => {
    update(id, (p) => {
      p.session = played.session;
      p.view = played.view;
      p.editing = false;
      p.inputProblem = null;
      p.note = null;
      p.banner = null;
      if (goal !== undefined) p.active = paths(played.session).get(goal) ?? null;
      if (played.view.complete) p.verdict = null;
    });
  };

  /** Runs a call, turning a stop into nothing and every other failure into the library's error. */
  async function attempt<T>(
    call: () => Promise<T>,
  ): Promise<{ ok: true; value: T } | { ok: false; failed: Failure | null }> {
    try {
      return { ok: true, value: await call() };
    } catch (thrown) {
      if (thrown instanceof Cancelled) return { ok: false, failed: null };
      return { ok: false, failed: failure(thrown instanceof Error ? thrown.message : thrown) };
    }
  }

  function save() {
    const shelf: Shelf = {
      version: 1,
      active: store.active,
      proofs: store.proofs
        .filter((p) => p.session || p.input.trim())
        .map(
          (p): StoredProof => ({
            id: p.id,
            input: p.input,
            mode: p.mode,
            session: p.session,
            redo: p.redo,
            saved: Date.now(),
          }),
        ),
    };
    saveShelf(storage(), visit, shelf);
  }

  const actions = {
    api,
    store,
    pending,
    busy,
    settings,
    aside,
    current,
    activeGoal,
    json,

    setSettings(change: Partial<Settings>) {
      const next = { ...settings(), ...change };
      setSettingsSignal(next);
      try {
        storage()?.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // The settings hold for this visit alone.
      }
    },

    /** At the page's start: sets the last visit's proofs aside for the restore bar. */
    begin() {
      setAsideShelf(setAside(storage(), visit));
    },

    /** Restores the last visit's proofs beside the open ones. */
    restore() {
      const shelf = aside();
      if (!shelf) return;
      batch(() => {
        for (const stored of shelf.proofs) {
          if (store.proofs.some((p) => p.id === stored.id || isOpen(p, stored))) continue;
          const proof: Proof = {
            ...blank(stored.mode),
            id: stored.id,
            input: stored.input,
            session: stored.session,
            redo: stored.redo.map((r) => [...r]),
            editing: !stored.session,
          };
          setStore("proofs", (all) => [...all.filter((p) => p.session || p.input.trim()), proof]);
        }
        setStore("active", shelf.active ?? store.proofs[0]?.id ?? null);
      });
      dropAside(storage());
      setAsideShelf(undefined);
      for (const p of store.proofs) if (p.session && !p.view) void actions.refresh(p.id);
      save();
    },

    /** Takes out of the restore bar the proofs open already (a link's). */
    prune() {
      if (!aside()) return;
      setAsideShelf(dropAside(storage(), (stored) => !store.proofs.some((p) => isOpen(p, stored))));
    },

    discard() {
      dropAside(storage());
      setAsideShelf(undefined);
    },

    save,

    /** Reads the view of a stored session again. */
    async refresh(id: string) {
      const p = store.proofs.find((q) => q.id === id);
      if (!p?.session) return;
      const result = await attempt(() => api.view(p.session as SessionDoc, json()));
      if (result.ok) update(id, (q) => (q.view = result.value));
    },

    /** Opens a new proof with the sequent field. */
    add(): string {
      const proof = blank(lastMode());
      setStore("proofs", (all) => [...all, proof]);
      setStore("active", proof.id);
      return proof.id;
    },

    activate(id: string) {
      setStore("active", id);
    },

    /** Closes a proof's tab; the page always keeps one. */
    remove(id: string) {
      const at = index(id);
      batch(() => {
        setStore("proofs", (all) => all.filter((p) => p.id !== id));
        if (store.active === id) setStore("active", store.proofs[Math.max(0, at - 1)]?.id ?? null);
        if (store.proofs.length === 0) actions.add();
      });
      save();
    },

    edit(id: string, editing: boolean) {
      update(id, (p) => {
        p.editing = editing;
        if (!editing) p.inputProblem = null;
      });
    },

    setInput(id: string, input: string) {
      update(id, (p) => {
        p.input = input;
        p.inputProblem = null;
      });
    },

    /** Reads the field's text as it is typed, for the fragment beside it. */
    async preview(id: string, input: string) {
      const read = await attempt(() => api.read(input, json()));
      const p = store.proofs.find((q) => q.id === id);
      if (!p || p.input !== input) return;
      update(id, (q) => (q.typed = read.ok ? (read.value.fragment ?? null) : null));
    },

    /** Starts the field's text as a new session in the proof's mode (or opens a session pasted there). */
    submit: guard(async (id: string, mode?: Mode) => {
      const p = store.proofs.find((q) => q.id === id);
      if (!p) return;
      const read = await attempt(() => api.read(p.input, json()));
      if (!read.ok) {
        if (read.failed) {
          const span = read.failed.details?.["span_utf16"] as
            | { start: number; end: number }
            | undefined;
          update(
            id,
            (q) =>
              (q.inputProblem = {
                ...inputProblem(read.failed as Failure),
                ...(span ? { span } : {}),
              }),
          );
        }
        return;
      }
      if (read.value.kind === "session" && read.value.session) {
        const session = read.value.session;
        const view = await attempt(() => api.view(session, json()));
        if (view.ok) {
          update(id, (q) => (q.mode = session.mode));
          show(id, { session, view: view.value }, view.value.goals[0]?.goal);
        }
        return;
      }
      const startMode = mode ?? p.mode;
      const started = await attempt(() => api.start(read.value.sequent, startMode, json()));
      if (!started.ok) {
        if (started.failed)
          update(id, (q) => (q.inputProblem = inputProblem(started.failed as Failure)));
        return;
      }
      setLastMode(startMode);
      update(id, (q) => {
        q.mode = startMode;
        q.redo = [];
        q.verdict = null;
      });
      show(id, started.value, 0);
      save();
    }),

    /** Changes the proof's calculus, which restarts a started proof from its sequent. */
    setMode: guard(async (id: string, mode: Mode) => {
      const p = store.proofs.find((q) => q.id === id);
      if (!p) return;
      setLastMode(mode);
      if (!p.session) {
        update(id, (q) => (q.mode = mode));
        return;
      }
      const started = await attempt(() =>
        api.start((p.session as SessionDoc).sequent, mode, json()),
      );
      if (!started.ok) {
        if (started.failed) update(id, (q) => (q.banner = inputProblem(started.failed as Failure)));
        return;
      }
      update(id, (q) => {
        q.mode = mode;
        q.redo = [];
        q.verdict = null;
      });
      show(id, started.value, 0);
      save();
    }),

    /** Opens a document (a sequent or a session as linlog writes them) as a new proof; says which it got. */
    async open(text: string, mode?: Mode): Promise<{ kind: string } | { problem: Said }> {
      const read = await attempt(() => api.read(text, json()));
      if (!read.ok)
        return {
          problem: read.failed ? inputProblem(read.failed) : { keyword: "Stopped", sentence: "" },
        };
      const id = actions.add();
      if (read.value.kind === "session" && read.value.session) {
        const session = read.value.session;
        const view = await attempt(() => api.view(session, json()));
        if (!view.ok)
          return {
            problem: view.failed ? inputProblem(view.failed) : { keyword: "Stopped", sentence: "" },
          };
        update(id, (q) => {
          q.mode = session.mode;
          q.input = read.value.text;
        });
        show(id, { session, view: view.value }, view.value.goals[0]?.goal);
        save();
        return { kind: "session" };
      }
      update(id, (q) => (q.input = text.trim().startsWith("{") ? read.value.text : text));
      const startMode = mode ?? read.value.mode ?? lastMode();
      const started = await attempt(() => api.start(read.value.sequent, startMode, json()));
      if (!started.ok) {
        if (started.failed)
          update(id, (q) => (q.inputProblem = inputProblem(started.failed as Failure)));
        return { kind: "sequent" };
      }
      update(id, (q) => (q.mode = startMode));
      show(id, started.value, 0);
      save();
      return { kind: "sequent" };
    },

    /**
     * Opens an example as a proof of its own, in place of the page's empty
     * one if that is shown: its sequent to prove, or with `watch` its proof
     * taken back to the sequent, each step on the redo stack by itself, so
     * that Redo plays the proof one step at a time. Nothing open is replaced.
     */
    example: guard(async (example: Example, watch: boolean) => {
      const empty = current();
      const blankId = empty && !empty.session && !empty.input.trim() ? empty.id : null;
      const opened = await actions.open(
        watch && example.session ? example.session : example.sequent,
        example.mode,
      );
      if ("problem" in opened) return;
      const p = current();
      if (blankId && blankId !== p?.id) actions.remove(blankId);
      if (!watch || !p?.session) return;
      const all = actionsOf(p.session);
      const result = await attempt(() => api.replay(p.session as SessionDoc, [], json()));
      if (!result.ok) return;
      update(p.id, (q) => {
        q.input = example.sequent;
        q.redo = all.toReversed().map((action) => [action]);
      });
      show(p.id, result.value, 0);
      save();
    }),

    /** Notes a line on the stage that is no goal's. */
    banner(id: string, said: Said | null) {
      update(id, (p) => (p.banner = said));
    },

    focus(goal: number) {
      const p = current();
      if (p) update(p.id, (q) => (q.active = pathOf(p, goal)));
    },

    /** Moves the active goal to the next (or previous) open one. */
    cycle(by: 1 | -1) {
      const p = current();
      const goals = p?.view?.goals.map((g) => g.goal) ?? [];
      const now = activeGoal(p);
      if (!p || now === undefined || goals.length === 0) return;
      const next = goals[(goals.indexOf(now) + by + goals.length) % goals.length] as number;
      actions.focus(next);
    },

    async rules(goal: number, position: number) {
      const p = current();
      if (!p?.session) return [];
      const result = await attempt(() =>
        api.rules(p.session as SessionDoc, goal, position, json()),
      );
      return result.ok ? result.value : [];
    },

    async splitPasses(goal: number, step: StepForm) {
      const p = current();
      if (!p?.session) return null;
      const result = await attempt(() =>
        api.splitPasses(p.session as SessionDoc, goal, step, json()),
      );
      return result.ok ? result.value : null;
    },

    /** Applies a step; a refusal becomes the note at the goal. Returns whether it applied. */
    apply: guard(async (goal: number, step: StepForm): Promise<boolean> => {
      const p = current();
      if (!p?.session) return false;
      const result = await attempt(() => api.apply(p.session as SessionDoc, goal, step, json()));
      if (!result.ok) {
        if (result.failed) {
          const formulas = p.view?.goals.find((g) => g.goal === goal)?.formulas ?? [];
          const said = refusal(result.failed, formulas, step.rule);
          update(p.id, (q) => (q.note = { path: pathOf(p, goal), said, tone: "bad" }));
        }
        return false;
      }
      update(p.id, (q) => (q.redo = []));
      show(p.id, result.value, result.value.opened[0] ?? result.value.view.goals[0]?.goal);
      save();
      return true;
    }),

    /** Undo on the active goal's branch (on a finished proof, the last step). */
    undo: guard(async () => {
      const p = current();
      if (!p?.session) return;
      const back = retract(p.session, p.view?.complete ? undefined : activeGoal(p));
      if (!back) {
        update(p.id, (q) => {
          q.note = {
            path: [],
            said: {
              keyword: "Nothing to undo on this branch",
              sentence: "This goal is the sequent itself, with no step on it yet.",
            },
            tone: "plain",
          };
        });
        return;
      }
      const result = await attempt(() => api.replay(p.session as SessionDoc, back.kept, json()));
      if (!result.ok) return;
      const reopened = goalAt(result.value.session, back.reopened);
      update(p.id, (q) => q.redo.push([...back.removed]));
      show(p.id, result.value, reopened);
      if (result.value.failed.length) actions.lost(p.id, result.value.failed);
      save();
    }),

    /** Goes back to the session as it was after its first `count` actions; redo brings the rest back. */
    backTo: guard(async (count: number) => {
      const p = current();
      if (!p?.session) return;
      const all = actionsOf(p.session);
      if (count >= all.length) return;
      const result = await attempt(() =>
        api.replay(p.session as SessionDoc, all.slice(0, count), json()),
      );
      if (!result.ok) return;
      const removed = all.slice(count);
      update(p.id, (q) => q.redo.push(removed));
      const reopened = removed[0] ? goalAt(result.value.session, removed[0].path) : undefined;
      show(p.id, result.value, reopened);
      if (result.value.failed.length) actions.lost(p.id, result.value.failed);
      save();
    }),

    /** Redoes what the last undo took back. */
    redo: guard(async () => {
      const p = current();
      const todo = p?.redo.at(-1);
      if (!p?.session || !p.view || !todo) return;
      const result = await attempt(() =>
        api.play({ session: p.session as SessionDoc, view: p.view as View }, todo, json()),
      );
      if (!result.ok) return;
      update(p.id, (q) => q.redo.pop());
      const under = todo[0]?.path ?? [];
      const open = result.value.view.goals.map((g) => g.goal);
      const where = paths(result.value.session);
      const next = open.find((g) => within(where.get(g) ?? [], under)) ?? open[0];
      show(p.id, result.value, next);
      if (result.value.failed.length) actions.lost(p.id, result.value.failed);
      save();
    }),

    /** Says that a replay left goals open that it had closed before. */
    lost(id: string, failed: readonly Path[]) {
      update(id, (q) => {
        q.note = {
          path: failed[0] ?? [],
          said: {
            keyword: "Not closed again",
            sentence:
              "A goal the search had closed did not close again within the budget, so it stays open; raise the budget in Settings and close it again.",
          },
          tone: "warn",
        };
      });
    },

    /** Closes a goal by the search, within the budget (times `factor`). */
    close: guard(async (goal: number, factor: number = 1) => {
      const p = current();
      if (!p?.session) return;
      const budget = settings().budget * factor;
      const path = pathOf(p, goal);
      const result = await attempt(() => api.close(p.session as SessionDoc, goal, json(budget)));
      if (!result.ok) {
        if (result.failed === null) {
          update(
            p.id,
            (q) =>
              (q.note = {
                path,
                said: { keyword: "Stopped", sentence: "The search was stopped." },
                tone: "warn",
              }),
          );
        } else {
          update(
            p.id,
            (q) => (q.note = { path, said: inputProblem(result.failed as Failure), tone: "bad" }),
          );
        }
        return;
      }
      const closed = result.value;
      if (closed.outcome.verdict === "proved" && !closed.refused) {
        update(p.id, (q) => (q.redo = []));
        show(p.id, closed, closed.view.goals[0]?.goal);
        save();
        return;
      }
      const said = closed.refused
        ? { keyword: "Proved, not grafted", sentence: closed.refused.message, tone: "warn" as Tone }
        : verdict(closed.outcome, closed.refutation_checked);
      update(p.id, (q) => {
        q.note = { path, said, tone: said.tone, outcome: closed.outcome, budget };
        if (path.length === 0) q.verdict = { ...said, outcome: closed.outcome };
      });
    }),

    /** Closes every open goal within one budget. */
    closeAll: guard(async () => {
      const p = current();
      if (!p?.session) return;
      const result = await attempt(() => api.closeAll(p.session as SessionDoc, json()));
      if (!result.ok) {
        if (result.failed === null) {
          update(
            p.id,
            (q) =>
              (q.note = {
                path: q.active ?? [],
                said: { keyword: "Stopped", sentence: "The search was stopped." },
                tone: "warn",
              }),
          );
        }
        return;
      }
      const closed = result.value;
      const before = p.session;
      const where = paths(before);
      const unproved = closed.results.find((r) => r.outcome && r.outcome.verdict !== "proved");
      update(
        p.id,
        (q) => (q.redo = closed.session.history.length !== before.history.length ? [] : q.redo),
      );
      show(p.id, closed, closed.view.goals[0]?.goal);
      if (unproved?.outcome) {
        const said = verdict(unproved.outcome, null);
        const path = where.get(unproved.goal) ?? [];
        update(p.id, (q) => {
          q.note = {
            path,
            said,
            tone: said.tone,
            outcome: unproved.outcome as Outcome,
            budget: settings().budget,
          };
          if (path.length === 0) q.verdict = { ...said, outcome: unproved.outcome as Outcome };
        });
      }
      save();
    }),

    stop() {
      api.cancel();
    },

    /** The note at a goal shown, cleared. */
    clearNote() {
      const p = current();
      if (p) update(p.id, (q) => (q.note = null));
    },
  };
  return actions;
}
