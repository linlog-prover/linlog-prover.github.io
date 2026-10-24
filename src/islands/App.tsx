// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The prover, one island: the top band (the open proofs), the stage (the
 * work) and the bottom band (what can be done with the proof). Here too
 * what holds the work: the link in the URL's fragment, written as the proof
 * changes and read when the page opens; autosave of every open proof, with
 * the restore bar on the next visit; the one hover rule for tips; the
 * keyboard; the hint ladder; light dismiss; and linlog's math fonts, whose
 * bytes the PNG and PDF exports render with, Euler Math also the drawings'.
 */

import { createEffect, createSignal, on, onCleanup, onMount, Show } from "solid-js";
import { unwrap } from "solid-js/store";
import { readLink, writeLink } from "../lib/link";
import { MATH_FONTS, type MathFont, type Mode } from "../lib/linlog";
import { paths } from "../lib/steps";
import { failure } from "../lib/linlog";
import { Cancelled } from "../lib/protocol";
import { inputProblem, pretty } from "../lib/words";
import type { Theme } from "../lib/theme";
import { type Example, type Lesson, type Rule, ruleNamed, type Stop } from "../lib/content";
import { BottomBand } from "./BottomBand";
import { LearnFrame, Schema } from "./Learn";
import { createPractice } from "./Practice";
import { Stage } from "./Stage";
import { createProver } from "./state";
import { TopBand } from "./TopBand";
import { Tour } from "./Tour";
import { createUi, ladderKey, Words } from "./ui";

export default function App(props: {
  /** The math fonts' addresses: the page imports them, so each is served under /fonts/ beside its licence. */
  fonts: Record<MathFont, string>;
  /** Learn's problems: the lessons' practice, in their order. */
  examples: readonly Example[];
  /** The tour's stops, in their order. */
  stops: readonly Stop[];
  /** Learn's written lessons, in their order. */
  lessons: readonly Lesson[];
  /** The one-sided rules, as the reference draws them. */
  rules: readonly Rule[];
}) {
  const view = createUi();
  const { ui, setUi } = view;
  const prover = createProver((text) => setUi("live", text));
  const practice = createPractice(prover);
  const [theme, setTheme] = createSignal<Theme>("system");
  const [tip, setTip] = createSignal<{
    text: string;
    key?: string;
    /** A rule's schema, which a rule of the popover shows with Learn on. */
    rule?: Rule;
    x: number;
    y: number;
  } | null>(null);
  const [linkShort, setLinkShort] = createSignal(false);
  let tipBox: HTMLDivElement | undefined;

  const fontBytes = new Map<MathFont, Promise<Uint8Array>>();
  /**
   * A math font's bytes, each fetched once when first asked for, and added to the document under
   * its family: Euler Math at the start, the stage's font when it is chosen, an export's when an
   * export is set in it; the PNG and PDF exports render with them.
   */
  const font = (name: MathFont = "euler") => {
    let bytes = fontBytes.get(name);
    if (!bytes) {
      const family = MATH_FONTS.find((f) => f.key === name)?.family ?? "Euler Math";
      bytes = fetch(props.fonts[name])
        .then((r) => r.arrayBuffer())
        .then((buffer) => {
          const face = new FontFace(family, buffer.slice(0));
          document.fonts.add(face);
          void face.load();
          return new Uint8Array(buffer);
        });
      // A failed fetch is asked again by the next export.
      bytes.catch(() => fontBytes.delete(name));
      fontBytes.set(name, bytes);
    }
    return bytes;
  };

  // The logic is set in the stage's font, which is loaded when it is chosen and not before.
  createEffect(() => {
    const chosen = prover.settings().stageFont;
    document.documentElement.dataset["mathFont"] = chosen;
    void font(chosen).catch(() => undefined);
  });

  // While the link and the saved proofs load, a change of the active proof is
  // the page starting, not the visitor's: a menu opened meanwhile stays open.
  let starting = true;
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
    starting = false;
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
        !starting &&
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

  // The one hover rule: any element with a tip shows it on hover and on focus, its key after the
  // words; a rule of the popover (`data-rule`, with Learn on) its schema and what it does.
  // A finger neither hovers nor means the focus a tap leaves: no tip follows a touch.
  onMount(() => {
    let touched = false;
    const pointer = (event: PointerEvent) => {
      touched = event.pointerType === "touch";
    };
    const typed = () => {
      touched = false;
    };
    const show = (event: Event) => {
      if (touched || (event instanceof PointerEvent && event.pointerType === "touch")) return;
      const element = (event.target as Element | null)?.closest?.("[data-tip], [data-rule]");
      if (!element) return;
      const r = element.getBoundingClientRect();
      const key = element.getAttribute("data-key");
      const named = ruleNamed(props.rules, element.getAttribute("data-rule") ?? "");
      // A rule the reference draws no schema of (Mix, weakening) has nothing to show.
      if (!named && !element.hasAttribute("data-tip")) return;
      setTip({
        text: named
          ? named.as === named.rule.name
            ? named.rule.says
            : `${named.as} is the two-sided name of ${named.rule.name}. ${named.rule.says}`
          : (element.getAttribute("data-tip") ?? ""),
        ...(named ? { rule: named.rule } : {}),
        ...(key ? { key } : {}),
        x: r.left,
        y: r.bottom + 6,
      });
    };
    const hide = () => setTip(null);
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", typed, true);
    document.addEventListener("pointerover", show);
    document.addEventListener("focusin", show);
    document.addEventListener("pointerout", hide);
    document.addEventListener("focusout", hide);
    onCleanup(() => {
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("keydown", typed, true);
      document.removeEventListener("pointerover", show);
      document.removeEventListener("focusin", show);
      document.removeEventListener("pointerout", hide);
      document.removeEventListener("focusout", hide);
    });
  });

  // Light dismiss: a press outside what is open closes it, as Escape does. A menu, a pane, More's
  // sheet or the bands' popovers stay open for a press inside them or on their own button; the
  // rule popover and the split chooser also for a press on a formula, by which a rule or a side
  // is chosen; the tour's caption is inside everything it shows. A press on the stage that
  // closes something does nothing else (no formula picked, no pan begun, no button pressed),
  // since the visitor aimed at the open thing; a press on a band's button closes it and acts.
  onMount(() => {
    let swallow = false;
    const pressed = (event: PointerEvent) => {
      swallow = false;
      const target = event.target as Element;
      if (target.closest(".tour")) return;
      const outside = (inside: string) => !target.closest(inside);
      let closed = false;
      if (ui.menu && outside(".menu, .status-pop, .calc-pop, [aria-expanded='true']:not(.fb)")) {
        setUi("menu", null);
        closed = true;
      }
      if (ui.pendingMode && outside(".mode-warn, .calc")) {
        setUi("pendingMode", null);
        closed = true;
      }
      if ((ui.selected || ui.split) && outside(".stage .pop, .fb")) {
        setUi({ selected: null, offered: null, split: null });
        closed = true;
      }
      if (closed && target.closest(".stage")) {
        swallow = true;
        event.stopPropagation();
      }
    };
    const clicked = (event: MouseEvent) => {
      if (!swallow) return;
      swallow = false;
      event.preventDefault();
      event.stopPropagation();
    };
    // A press that never clicks (a drag) leaves nothing to swallow for a key's click.
    const typed = () => {
      swallow = false;
    };
    document.addEventListener("pointerdown", pressed, true);
    document.addEventListener("click", clicked, true);
    document.addEventListener("keydown", typed, true);
    onCleanup(() => {
      document.removeEventListener("pointerdown", pressed, true);
      document.removeEventListener("click", clicked, true);
      document.removeEventListener("keydown", typed, true);
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
      // In a field the keys are the field's; Escape still closes a menu around it.
      if (event.key !== "Escape" && (event.target as Element).closest("input, textarea, select"))
        return;
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
        l: () => setUi("learn", ui.learn ? null : "tutorial"),
        p: () => setUi("menu", ui.menu === "practice" ? null : "practice"),
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
          practice={practice}
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
          lessons={props.lessons}
          rules={props.rules}
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
            <Show when={t().rule} fallback={t().text}>
              {(rule) => (
                <>
                  <Schema rule={rule()} />
                  <span>
                    <Words text={t().text} />
                  </span>
                </>
              )}
            </Show>
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
