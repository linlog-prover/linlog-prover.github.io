// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The prover, one island: the top band (the open proofs), the stage (the
 * work) and the bottom band (what can be done with the proof). Here too
 * what holds the work: the link in the URL's fragment, written as the proof
 * changes and read when the page opens; autosave of every open proof, with
 * the restore bar on the next visit; the one hover rule for tips; the
 * keyboard; the hint ladder; and the Euler Math font, whose bytes the PNG
 * and PDF exports render with.
 */

import { createEffect, createSignal, on, onCleanup, onMount, Show } from "solid-js";
import { unwrap } from "solid-js/store";
import { readLink, writeLink } from "../lib/link";
import type { Mode } from "../lib/linlog";
import { paths } from "../lib/steps";
import { failure } from "../lib/linlog";
import { Cancelled } from "../lib/protocol";
import { inputProblem, pretty } from "../lib/words";
import type { Theme } from "../lib/theme";
import type { Example, Stop } from "../lib/content";
import { BottomBand } from "./BottomBand";
import { LearnFrame } from "./Learn";
import { Stage } from "./Stage";
import { createProver } from "./state";
import { TopBand } from "./TopBand";
import { Tour } from "./Tour";
import { createUi, ladderKey } from "./ui";

export default function App(props: {
  /** Euler Math's address: the page imports it, so the font is served under /fonts/ beside its licence. */
  font: string;
  /** Learn's practice: the examples, in their order. */
  examples: readonly Example[];
  /** The tour's stops, in their order. */
  stops: readonly Stop[];
}) {
  const view = createUi();
  const { ui, setUi } = view;
  const prover = createProver((text) => setUi("live", text));
  const [theme, setTheme] = createSignal<Theme>("system");
  const [tip, setTip] = createSignal<{ text: string; key?: string; x: number; y: number } | null>(
    null,
  );
  const [linkShort, setLinkShort] = createSignal(false);
  let tipBox: HTMLDivElement | undefined;

  let fontBytes: Promise<Uint8Array> | undefined;
  /** Euler Math's bytes, fetched once: for the page's drawings and the PNG and PDF exports. */
  const font = () => {
    fontBytes ??= fetch(props.font)
      .then((r) => r.arrayBuffer())
      .then((buffer) => {
        const face = new FontFace("Euler Math", buffer.slice(0));
        document.fonts.add(face);
        void face.load();
        return new Uint8Array(buffer);
      });
    return fontBytes;
  };

  onMount(async () => {
    void font().catch(() => undefined);
    // The worker starts with the first call: this one, so that linlog's
    // module loads after the first paint, before the visitor's first step.
    void prover.api.about().catch(() => undefined);
    prover.begin();
    const link = await readLink(location.hash);
    if (link) {
      const restored = link.session !== undefined ? await prover.open(link.session) : null;
      if (!restored || "problem" in restored) {
        const opened = await prover.open(link.sequent, link.mode as Mode);
        const p = prover.current();
        if ("problem" in opened) {
          // The link's sequent does not parse: it goes into the field with its
          // problem marked, as if it had been typed.
          const id = prover.add();
          prover.setInput(id, link.sequent);
          await prover.setMode(id, link.mode as Mode);
          await prover.submit(id);
        } else if (p && (link.session !== undefined || link.problem)) {
          prover.banner(p.id, {
            keyword: "Proof not restored",
            sentence:
              restored && "problem" in restored
                ? `The link's proof was not read (${restored.problem.keyword}), so the sequent is loaded alone: start again, or import the session file.`
                : link.problem === "version"
                  ? "The link was made by another version of this page, so the sequent is loaded alone."
                  : link.problem === "size"
                    ? "The link's proof unpacks to more than a link may hold, so the sequent is loaded alone: import the session file instead."
                    : "The link's proof did not unpack, so the sequent is loaded alone.",
          });
        }
      }
    }
    prover.prune();
    if (prover.store.proofs.length === 0) prover.add();
  });

  // Autosave: every change of a proof, a moment after it settles.
  let saving: ReturnType<typeof setTimeout> | undefined;
  createEffect(
    on(
      () => prover.store.proofs.map((p) => [p.session, p.input, p.mode, p.redo.length]),
      () => {
        clearTimeout(saving);
        saving = setTimeout(() => prover.save(), 300);
      },
      { defer: true },
    ),
  );

  // The link: the proof shown, written into the fragment as it changes.
  let linking: ReturnType<typeof setTimeout> | undefined;
  createEffect(
    on(
      () => [prover.current()?.session, prover.current()?.mode, prover.current()?.input] as const,
      ([session, mode, input]) => {
        clearTimeout(linking);
        if (!session || !mode || !input) return;
        linking = setTimeout(async () => {
          const written = await writeLink(pretty(input), mode, JSON.stringify(unwrap(session)));
          history.replaceState(null, "", written.hash);
          setLinkShort(!written.whole);
        }, 400);
      },
      { defer: true },
    ),
  );

  // Closing a menu when the proof changes; the hint ladder stays with its goal.
  createEffect(
    on(
      () => prover.store.active,
      () =>
        setUi({
          // An import opens its proof and keeps the panel, to say what it read.
          menu: ui.menu === "import" ? "import" : null,
          selected: null,
          offered: null,
          split: null,
          pendingMode: null,
        }),
      { defer: true },
    ),
  );

  /** The next rung of the hint ladder on the active goal. */
  async function hint() {
    const p = prover.current();
    const goal = prover.activeGoal();
    if (!p?.session || goal === undefined) return;
    const key = ladderKey(p.id, paths(p.session).get(goal) ?? []);
    const ladder = ui.ladder?.key === key ? ui.ladder : null;
    if (!ladder) {
      setUi("ladder", { key, rung: 1, hint: null });
      try {
        const answer = await prover.api.hint(p.session, goal, prover.json());
        if (ui.ladder?.key === key) setUi("ladder", (l) => (l ? { ...l, hint: answer } : l));
      } catch (thrown) {
        if (ui.ladder?.key === key) setUi("ladder", null);
        // A refusal (a forced engine that does not take the goal) is said at the goal.
        if (!(thrown instanceof Cancelled))
          prover.note(
            goal,
            inputProblem(failure(thrown instanceof Error ? thrown.message : thrown)),
            "bad",
          );
      }
      return;
    }
    const steps = ladder.hint?.steps;
    if (!steps) return;
    if (ladder.rung < 3) {
      setUi("ladder", { ...ladder, rung: ladder.rung + 1 });
      return;
    }
    if (ladder.rung === 3) {
      // The bottom-out: the page applies the steps, each on the goal the one before opened.
      const hinted = ladder.hint;
      let at = goal;
      for (const step of steps) {
        if (!(await prover.apply(at, step))) return;
        const next = prover.activeGoal();
        if (next === undefined) break;
        at = next;
      }
      const now = prover.current();
      const after = prover.activeGoal();
      if (now?.session && after !== undefined && hinted) {
        setUi("ladder", {
          key: ladderKey(now.id, paths(now.session).get(after) ?? []),
          rung: 4,
          hint: hinted,
        });
      }
      setUi(
        "live",
        now?.view?.complete ? "Applied the hint: the proof is finished." : "Applied the hint.",
      );
    }
  }

  // The one hover rule: any element with a tip shows it on hover and on focus, its key after the words.
  onMount(() => {
    const show = (event: Event) => {
      const element = (event.target as Element | null)?.closest?.("[data-tip]");
      if (!element) return;
      const r = element.getBoundingClientRect();
      const key = element.getAttribute("data-key");
      setTip({
        text: element.getAttribute("data-tip") ?? "",
        ...(key ? { key } : {}),
        x: r.left,
        y: r.bottom + 6,
      });
    };
    const hide = () => setTip(null);
    document.addEventListener("pointerover", show);
    document.addEventListener("focusin", show);
    document.addEventListener("pointerout", hide);
    document.addEventListener("focusout", hide);
    onCleanup(() => {
      document.removeEventListener("pointerover", show);
      document.removeEventListener("focusin", show);
      document.removeEventListener("pointerout", hide);
      document.removeEventListener("focusout", hide);
    });
  });

  createEffect(() => {
    const t = tip();
    if (!t || !tipBox) return;
    const width = tipBox.offsetWidth;
    const height = tipBox.offsetHeight;
    const x = Math.max(8, Math.min(t.x, window.innerWidth - width - 8));
    const y = t.y + height > window.innerHeight - 8 ? t.y - height - 40 : t.y;
    tipBox.style.left = `${x}px`;
    tipBox.style.top = `${y}px`;
  });

  // The keyboard: every action the mouse has, by single keys outside the field.
  onMount(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if ((event.target as Element).closest("input, textarea, select")) return;
      const goal = prover.activeGoal();
      const act: Record<string, () => void> = {
        u: () => void prover.undo(),
        U: () => void prover.redo(),
        c: () => goal !== undefined && void prover.close(goal),
        C: () => void prover.closeAll(),
        h: () => void hint(),
        "[": () => prover.cycle(-1),
        "]": () => prover.cycle(1),
        v: () =>
          setUi(
            "tab",
            ui.tab === "tree" && prover.current()?.view?.complete && !prover.current()?.view?.net
              ? "net"
              : "tree",
          ),
        n: () => {
          prover.add();
          queueMicrotask(() => document.querySelector<HTMLInputElement>(".field")?.focus());
        },
        e: () => setUi("menu", ui.menu === "export" ? null : "export"),
        s: () => setUi("menu", ui.menu === "steps" ? null : "steps"),
        i: () => setUi("menu", ui.menu === "import" ? null : "import"),
        ",": () => setUi("menu", ui.menu === "settings" ? null : "settings"),
        "?": () => setUi("menu", ui.menu === "keys" ? null : "keys"),
        l: () => setUi("learn", ui.learn ? null : "practice"),
        Escape: () => {
          setTip(null);
          setUi({ menu: null, pendingMode: null });
        },
      };
      const action = act[event.key];
      if (!action) return;
      if (event.key === "Escape" && ui.menu === null && !ui.pendingMode) return;
      event.preventDefault();
      action();
    };
    window.addEventListener("keydown", keys);
    onCleanup(() => window.removeEventListener("keydown", keys));
  });

  // A note at a goal is said in the live region too, for a screen reader.
  createEffect(
    on(
      () => prover.current()?.note,
      (note) => {
        if (note) setUi("live", `${note.said.keyword}. ${note.said.sentence}`);
      },
      { defer: true },
    ),
  );

  return (
    <div
      class="app"
      data-keys={prover.settings().showKeys ? "" : undefined}
      data-learn={ui.learn ? "" : undefined}
    >
      <div class="win">
        <TopBand prover={prover} ui={view} theme={theme} setTheme={setTheme} />
        <Show when={prover.aside()}>
          {(shelf) => (
            <section class="restore cluster" aria-label="Restore">
              <span>
                {shelf().proofs.length} {shelf().proofs.length === 1 ? "proof" : "proofs"} from your
                last visit
              </span>
              <button type="button" class="btn btn-primary" onClick={() => prover.restore()}>
                Restore
              </button>
              <button type="button" class="btn" onClick={() => prover.discard()}>
                Discard
              </button>
            </section>
          )}
        </Show>
        <Stage prover={prover} ui={view} />
        <Show when={linkShort() && ui.menu === "export"}>
          <p class="sr-only">The link holds the sequent alone.</p>
        </Show>
        <BottomBand
          prover={prover}
          ui={view}
          hint={() => void hint()}
          font={font}
          theme={theme}
          setTheme={setTheme}
          tour={() => {
            setUi({ menu: null, tour: null });
            setUi("tour", 0);
          }}
        />
      </div>
      <Show when={ui.learn}>
        <LearnFrame
          prover={prover}
          ui={view}
          examples={props.examples}
          tour={() => {
            setUi({ tour: null });
            setUi("tour", 0);
          }}
        />
      </Show>
      <Tour prover={prover} ui={view} stops={props.stops} />
      <Show when={tip()}>
        {(t) => (
          <div class="tip" ref={tipBox} role="tooltip">
            {t().text}
            <Show when={t().key}>{(k) => <kbd>{k()}</kbd>}</Show>
          </div>
        )}
      </Show>
      <div class="sr-only" aria-live="polite">
        {ui.live}
      </div>
    </div>
  );
}
