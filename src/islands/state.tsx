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
  type Engines,
  failure,
  type Failure,
  type GoalFormula,
  MATH_FONTS,
  type MathFont,
  type Mode,
  type Outcome,
  type Played,
  type SequentDoc,
  type SessionDoc,
  type StepForm,
  type View,
} from "../lib/linlog";
import type { Example } from "../lib/content";
import { ENGINE_ORDER, engineName, engineOf, fromTab } from "../lib/engines";
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
import {
  displayed,
  fillRefusal,
  inputProblem,
  refusal,
  type Said,
  short,
  type Tone,
  verdict,
} from "../lib/words";

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
  /** The engine of each search that closed a goal, by the goal's path joined with dots. */
  engines: Record<string, string>;
  /** The tab and goal the proof was opened from ("Open in a new tab"), or null. */
  origin: { readonly from: string; readonly path: Path } | null;
}

/** The visitor's settings, kept in the browser but for the engine, which holds for the visit. */
export interface Settings {
  /** The search's work budget per call, `limits.work`. */
  budget: number;
  /** Whether the actions print their keys beside their names. */
  showKeys: boolean;
  /** How a net is drawn, `styles.svg.net`: every formula written, or compact. */
  net: NetDrawing;
  /** How a net looks, `styles.svg.net_look`: linlog's own look, the textbooks', or a mix. */
  netLook: NetLook;
  /**
   * The engine every search is forced to, `search.engine`; null for linlog's own choice. Never
   * stored: a forced engine refuses what it does not take, so every visit starts on linlog's.
   */
  engine: string | null;
  /** The math font the stage's drawing, its formulas and the tabs' sequents are set in. */
  stageFont: MathFont;
  /** The math font the SVG, PNG and PDF exports are set in, `styles.svg.font`; null for the stage's. */
  font: MathFont | null;
  /** Whether linlog applies every invertible rule by itself after each step, `interactive.invertible`. */
  invertible: boolean;
}

/** The math font the exports are set in: the one chosen for them, else the stage's. */
export const exportFont = (settings: Settings): MathFont => settings.font ?? settings.stageFont;

/** linlog's two drawings of a net: every formula occurrence written, or only the literals and the conclusions. */
export type NetDrawing = "formulas" | "compact";

/**
 * How a net looks, linlog's `svg::NetLook`: the edges into a ⅋ or ? dashed or plain; a ! with
 * auxiliary doors a row up or with every conclusion at the bottom; a ? one node or its rules'
 * nodes ?d, ?c and ?w.
 */
export interface NetLook {
  readonly premises: "dashed" | "plain";
  readonly conclusions: "raised" | "bottom";
  readonly whyNot: "node" | "rules";
}

/** linlog's own look, its default. */
export const LINLOG_LOOK: NetLook = { premises: "dashed", conclusions: "raised", whyNot: "node" };

/** The look the textbooks share, linlog's preset `textbook`. */
export const TEXTBOOK_LOOK: NetLook = { premises: "plain", conclusions: "bottom", whyNot: "rules" };

/** Whether two looks are the same. */
export const sameLook = (a: NetLook, b: NetLook) =>
  a.premises === b.premises && a.conclusions === b.conclusions && a.whyNot === b.whyNot;

/** A look as linlog's settings write it, `styles.svg.net_look`. */
export const lookJson = (look: NetLook) => ({
  premises: look.premises,
  conclusions: look.conclusions,
  why_not: look.whyNot,
});

/** A stored look, each field linlog's default where it is not one of its values. */
const storedLook = (stored: unknown): NetLook => {
  const look = (typeof stored === "object" && stored !== null ? stored : {}) as Partial<NetLook>;
  return {
    premises: look.premises === "plain" ? "plain" : "dashed",
    conclusions: look.conclusions === "bottom" ? "bottom" : "raised",
    whyNot: look.whyNot === "rules" ? "rules" : "node",
  };
};

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
      net: stored.net === "compact" ? "compact" : "formulas",
      netLook: storedLook(stored.netLook),
      engine: null,
      stageFont: MATH_FONTS.find((f) => f.key === stored.stageFont)?.key ?? "euler",
      font: MATH_FONTS.find((f) => f.key === stored.font)?.key ?? null,
      invertible: stored.invertible === true,
    };
  } catch {
    return {
      budget: DEFAULT_BUDGET,
      showKeys: false,
      net: "formulas",
      netLook: LINLOG_LOOK,
      engine: null,
      stageFont: "euler",
      font: null,
      invertible: false,
    };
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
  engines: {},
  origin: null,
});

/** A goal's formulas as a key, equal for the same formulas in any order: how two tabs' sequents are compared. */
const keyOf = (formulas: readonly GoalFormula[]) =>
  formulas
    .map((f) => `${f.side ?? ""}:${f.text}`)
    .sort()
    .join("\n");

/**
 * A goal's sequent as the sequent field reads it: two-sided where the formulas have sides, each
 * formula as its reading writes it (a hypothesis `A ⊸ B`), the dual of its one-sided formula
 * only where linlog gives no reading.
 */
const sequentText = (formulas: readonly GoalFormula[]) => {
  // A formula as its reading writes it, which linlog gives in intuitionistic mode. Without one, a
  // hypothesis is its one-sided formula's dual (linlog's `text` writes the hypothesis A as A⊥): a
  // negated atom loses its negation, any other formula is negated whole.
  const dual = (text: string) => {
    const atom = /^~\s*([\p{L}_][\p{L}\p{N}_']*)$/u.exec(text);
    return atom ? atom[1] : `~(${text})`;
  };
  const left = formulas.filter((f) => f.side === "input").map((f) => f.reading ?? dual(f.text));
  const right = formulas.filter((f) => f.side !== "input").map((f) => f.reading ?? f.text);
  return `${left.join(", ")}${left.length ? " " : ""}|- ${right.join(", ")}`;
};

/** A goal's path as the key of `Proof.engines`. */
export const pathKey = (path: Path) => path.join(".");

/** The prover's state and actions, for one island. */
export type Prover = ReturnType<typeof createProver>;

/** Creates the state, its worker and its actions; `say` speaks in the page's live region. */
export function createProver(say: (text: string) => void = () => undefined) {
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
  let running: Promise<unknown> = Promise.resolve();
  const guard =
    <A extends unknown[], R>(run: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R | undefined> => {
      if (busy()) return undefined;
      setBusy(true);
      const now = run(...args);
      running = now.catch(() => undefined);
      try {
        return await now;
      } finally {
        setBusy(false);
      }
    };
  /** As `guard`, but an action asked for while another runs waits for it instead of doing nothing. */
  const queued =
    <A extends unknown[], R>(run: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R | undefined> => {
      while (busy()) await running;
      return guard(run)(...args);
    };

  /**
   * The settings as linlog reads them: the tab's defaults with the budget, the engine forced,
   * and the invertible rules applied by themselves when they are on.
   */
  const json = (budget = settings().budget, invertible = settings().invertible) => {
    const engine = settings().engine;
    return JSON.stringify({
      limits: { work: budget },
      ...(engine ? { search: { engine } } : {}),
      ...(invertible ? { interactive: { invertible } } : {}),
    });
  };
  /**
   * The settings of a replay, and of a start that only reads the sequent: without the
   * invertible rules, which a replay plays as the steps they were, so that applying them
   * again after each would leave the recorded ones no goal.
   */
  const replaying = () => json(settings().budget, false);

  const current = () => store.proofs.find((p) => p.id === store.active);
  const index = (id: string) => store.proofs.findIndex((p) => p.id === id);

  /** A proof's actions, a proof filled in from another tab replayed from its own inferences. */
  const actionsFor = (p: Proof, list: readonly Action[]): Action[] =>
    list.map((a) =>
      a.kind === "close" && p.engines[pathKey(a.path)]?.startsWith("tab:")
        ? { ...a, own: true }
        : a,
    );

  /** Each finished tab's sequent as a key, by its mode and sequent document. */
  const keys = new Map<string, string>();
  const sequentKey = async (q: Proof): Promise<string | null> => {
    if (!q.session) return null;
    const at = `${q.mode}\n${JSON.stringify(q.session.sequent)}`;
    const known = keys.get(at);
    if (known !== undefined) return known;
    const started = await attempt(() =>
      api.start(q.session?.sequent as SequentDoc, q.mode, replaying()),
    );
    const root = started.ok ? started.value.view.goals[0] : undefined;
    if (!root) return null;
    const key = keyOf(root.formulas);
    keys.set(at, key);
    return key;
  };

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
            engines: p.engines,
            origin: p.origin,
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

    /**
     * Turns the invertible rules applied by themselves on or off; on, they are applied at once to
     * every open goal of every proof, as they would have been after each step.
     */
    setInvertible: guard(async (on: boolean) => {
      actions.setSettings({ invertible: on });
      if (!on) return;
      for (const p of store.proofs) {
        if (!p.session || p.view?.complete) continue;
        const result = await attempt(() => api.invertAll(p.session as SessionDoc, replaying()));
        if (!result.ok || result.value.inverted === 0) continue;
        show(p.id, result.value, activeGoal({ ...p, ...result.value }));
      }
      save();
    }),

    setSettings(change: Partial<Settings>) {
      const next = { ...settings(), ...change };
      setSettingsSignal(next);
      try {
        const { engine: _, ...kept } = next;
        storage()?.setItem(SETTINGS_KEY, JSON.stringify(kept));
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
            engines: { ...(stored.engines ?? {}) },
            origin: stored.origin ?? null,
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

    /**
     * Starts the field's text as a new session in the proof's mode (or opens
     * a session pasted there); asked for while another action runs, it waits
     * for that one.
     */
    submit: queued(async (id: string, mode?: Mode) => {
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
        q.engines = {};
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
        q.engines = {};
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
     * Opens a problem (Learn's or Practice's) as a proof of its own, in place
     * of the page's empty one if that is shown: its sequent to prove, or with `watch` its proof
     * taken back to the sequent, each step on the redo stack by itself, so
     * that Redo plays the proof one step at a time. Nothing open is replaced.
     */
    example: guard(
      async (example: Pick<Example, "sequent" | "mode" | "session">, watch: boolean) => {
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
        const result = await attempt(() => api.replay(p.session as SessionDoc, [], replaying()));
        if (!result.ok) return;
        update(p.id, (q) => {
          q.input = example.sequent;
          q.redo = all.toReversed().map((action) => [action]);
        });
        show(p.id, result.value, 0);
        save();
      },
    ),

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
      // With the invertible rules on, undo takes back the visitor's last choice with the
      // invertible steps after it: taking back one of those alone, the page would apply it again.
      const invertible = settings().invertible ? new Set(p.view?.invertible ?? []) : undefined;
      const retracted = retract(
        p.session,
        p.view?.complete ? undefined : activeGoal(p),
        invertible,
      );
      const back = retracted && {
        ...retracted,
        kept: actionsFor(p, retracted.kept),
        removed: actionsFor(p, retracted.removed),
      };
      if (!back) {
        // Steps there are, but each one the page applied by itself.
        const automatic =
          invertible !== undefined && retract(p.session, activeGoal(p)) !== undefined;
        update(p.id, (q) => {
          q.note = {
            path: [],
            said: {
              keyword: "Nothing to undo on this branch",
              sentence: automatic
                ? "Every step on this branch is an invertible rule the page applied by itself."
                : "This goal is the sequent itself, with no step on it yet.",
            },
            tone: "plain",
          };
        });
        return;
      }
      const result = await attempt(() =>
        api.replay(p.session as SessionDoc, back.kept, replaying()),
      );
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
      const all = actionsFor(p, actionsOf(p.session));
      if (count >= all.length) return;
      const result = await attempt(() =>
        api.replay(p.session as SessionDoc, all.slice(0, count), replaying()),
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
        api.play({ session: p.session as SessionDoc, view: p.view as View }, todo, replaying()),
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

    /**
     * Opens a goal as a proof of its own in a new tab, in the same calculus; the new proof
     * remembers the tab and goal it came from.
     */
    openGoal: guard(async (goal: number) => {
      const p = current();
      const g = p?.view?.goals.find((x) => x.goal === goal);
      if (!p?.session || !g) return;
      const opened = await actions.open(sequentText(g.formulas), p.mode);
      if ("problem" in opened) return;
      const q = current();
      if (q && q.id !== p.id)
        update(q.id, (x) => (x.origin = { from: p.id, path: pathOf(p, goal) }));
      say(`Goal ${goal + 1} opened in tab ${index(q?.id ?? "") + 1}.`);
      save();
    }),

    /**
     * The other tabs whose finished proof is of a goal's formulas in any order, by id and by
     * their sequent shortened, which names a tab as its place in the row cannot: that changes as
     * tabs close.
     */
    async fillable(goal: number): Promise<{ id: string; tab: string }[]> {
      const p = current();
      const g = p?.view?.goals.find((x) => x.goal === goal);
      if (!p || !g) return [];
      const want = keyOf(g.formulas);
      const found: { id: string; tab: string }[] = [];
      for (const q of store.proofs) {
        if (q.id === p.id || !q.view?.complete) continue;
        if ((await sequentKey(q)) === want)
          found.push({ id: q.id, tab: short(displayed(q.input)) });
      }
      return found;
    },

    /**
     * Fills a goal with the finished proof of another tab of the same formulas, as one step
     * named with that tab; linlog checks it in this proof's calculus, and a refusal is said at
     * the goal.
     */
    fill: guard(async (goal: number, from: string) => {
      const p = current();
      const q = store.proofs.find((x) => x.id === from);
      if (!p?.session || !q?.session) return;
      const path = pathOf(p, goal);
      const result = await attempt(() =>
        api.fill(p.session as SessionDoc, goal, q.session as SessionDoc, json()),
      );
      const tab = short(displayed(q.input));
      if (!result.ok) {
        if (result.failed)
          update(p.id, (x) => {
            x.note = { path, said: fillRefusal(result.failed as Failure, tab), tone: "bad" };
          });
        return;
      }
      update(p.id, (x) => {
        x.redo = [];
        x.engines = { ...x.engines, [pathKey(path)]: fromTab(tab) };
      });
      show(p.id, result.value, result.value.view.goals[0]?.goal);
      say(
        `Goal ${goal + 1} filled from ${tab}${result.value.view.complete ? ": the proof is finished" : ""}.`,
      );
      save();
    }),

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
      const engine = engineOf(closed.outcome);
      if (closed.outcome.verdict === "proved" && !closed.refused) {
        update(p.id, (q) => {
          q.redo = [];
          if (engine) q.engines = { ...q.engines, [pathKey(path)]: engine };
        });
        show(p.id, closed, closed.view.goals[0]?.goal);
        say(
          `Goal ${goal + 1} closed${engine ? ` by the ${engineName(engine)}` : ""}${closed.view.complete ? ": the proof is finished" : ""}.`,
        );
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
      const grafted: Record<string, string> = {};
      for (const r of closed.results) {
        const engine = engineOf(r.outcome);
        if (r.outcome?.verdict === "proved" && !r.refused && engine)
          grafted[pathKey(where.get(r.goal) ?? [])] = engine;
      }
      update(p.id, (q) => {
        q.redo = closed.session.history.length !== before.history.length ? [] : q.redo;
        q.engines = { ...q.engines, ...grafted };
      });
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

    /**
     * The engines for a proof's sequent: the one linlog picks, and for each
     * engine whether it takes the sequent or the refusal a search forced to it
     * answers before it starts (each asked with a budget of one unit, so that
     * none searches).
     */
    async engines(session: SessionDoc): Promise<Engines> {
      const asked = (engine?: string) =>
        attempt(() =>
          api.prove(
            session.sequent,
            session.mode,
            JSON.stringify({
              limits: { work: 1 },
              search: { classical_work: 1, ...(engine ? { engine } : {}) },
            }),
          ),
        );
      const automatic = await asked();
      const engines = [];
      for (const engine of ENGINE_ORDER) {
        const answer = await asked(engine);
        engines.push({ engine, refused: answer.ok ? null : answer.failed });
      }
      return {
        automatic: automatic.ok ? (automatic.value.outcome.engine ?? null) : null,
        engines,
      };
    },

    /** Notes at a goal what the page has to say there: a hint's failure. */
    note(goal: number, said: Said, tone: Tone) {
      const p = current();
      if (p) update(p.id, (q) => (q.note = { path: pathOf(p, goal), said, tone }));
    },

    /** The note at a goal shown, cleared. */
    clearNote() {
      const p = current();
      if (p) update(p.id, (q) => (q.note = null));
    },
  };
  return actions;
}
