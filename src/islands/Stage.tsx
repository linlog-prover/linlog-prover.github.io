// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The stage: linlog's drawing of the proof (the derivation, or the finished
 * proof's net) on the dotted field, under a camera that zooms and pans; a
 * button over every formula of an open goal (the drawing stays a picture,
 * WCAG's rule for an interactive SVG); and at the active goal everything
 * that acts on it: the dock (the goal navigator, the goal's close, the note,
 * the hint), the rule popover and the split chooser.
 */

import { ChevronLeft, ChevronRight, Maximize, ZoomIn, ZoomOut } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { failure, type Offered, type StepForm } from "../lib/linlog";
import { goalAt, paths, searchMade } from "../lib/steps";
import { formulaText, rungs } from "../lib/words";
import { Calculus } from "./Calculus";
import type { Prover } from "./state";
import { ladderKey, type Ui } from "./ui";

/** A formula's button over the drawing, in the drawing's own pixels. */
interface Hit {
  readonly goal: number;
  readonly position: number;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The camera: the drawing's offset in the stage and its scale. */
interface Camera {
  readonly x: number;
  readonly y: number;
  readonly k: number;
}

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The settings of the stage's drawing: the formulas large enough to click. */
const drawSettings = (work: number) =>
  JSON.stringify({ limits: { work }, styles: { svg: { font_size: 30 } } });

export function Stage(props: { prover: Prover; ui: Ui }) {
  const prover = () => props.prover;
  const proof = () => props.prover.current();
  const { ui, setUi, drawn, setDrawn } = props.ui;
  let stage!: HTMLElement;
  let world!: HTMLDivElement;
  let host!: HTMLDivElement;
  let dock: HTMLDivElement | undefined;
  let popover: HTMLDivElement | undefined;
  const [hits, setHits] = createSignal<Hit[]>([]);
  const [camera, setCamera] = createSignal<Camera>({ x: 0, y: 0, k: 1 });
  const [problem, setProblem] = createSignal<string | null>(null);
  const [glide, setGlide] = createSignal(false);
  let sequence = 0;
  let shownProof: string | undefined;

  const view = () => proof()?.view ?? null;
  const active = () => prover().activeGoal();
  const openCount = () => view()?.goals.length ?? 0;
  const formulasOf = (goal: number) => view()?.goals.find((g) => g.goal === goal)?.formulas ?? [];

  /** The drawing's `i<n>` of a goal. */
  const drawingIndex = (goal: number) => view()?.inferences.indexOf(goal) ?? -1;

  const netReady = () => {
    const v = view();
    return !!v && v.complete && v.net === null;
  };

  // A new drawing whenever the session, the tab or the proof changes.
  createEffect(
    on(
      () => [proof()?.session, proof()?.view, ui.tab, props.prover.store.active] as const,
      async ([session, v, tab]) => {
        const mine = ++sequence;
        if (!session || !v) {
          host.replaceChildren();
          setHits([]);
          return;
        }
        const net = tab === "net" && v.complete && v.net === null;
        let svg: string;
        try {
          const settings = drawSettings(props.prover.settings().budget);
          svg = net
            ? await props.prover.api.drawNet(session, settings)
            : await props.prover.api.draw(session, settings);
        } catch (thrown) {
          if (mine !== sequence) return;
          host.replaceChildren();
          setHits([]);
          setProblem(failure(thrown instanceof Error ? thrown.message : thrown).message);
          return;
        }
        if (mine !== sequence) return;
        setProblem(null);
        const hadFocus =
          stage.contains(document.activeElement) || document.activeElement === document.body;
        host.innerHTML = svg;
        decorate(net);
        const fresh = shownProof !== props.prover.store.active;
        shownProof = props.prover.store.active ?? undefined;
        if (fresh) fitView();
        else bringIntoView();
        setDrawn((n) => n + 1);
        if (hadFocus && !net) {
          queueMicrotask(() =>
            stage
              .querySelector<HTMLButtonElement>(".fb[data-active]")
              ?.focus({ preventScroll: true }),
          );
        }
      },
    ),
  );

  /** Marks the open goals, the active one and the search's inferences, and lays the buttons over the formulas. */
  function decorate(net: boolean) {
    const v = view();
    const session = proof()?.session;
    if (!v || !session) return;
    const open = new Set(v.goals.map((g) => g.goal));
    const made = searchMade(session);
    const act = active();
    v.inferences.forEach((inference, n) => {
      const group = host.querySelector(`#i${n}`);
      if (!group) return;
      group.classList.toggle("open-goal", open.has(inference));
      group.classList.toggle("active", inference === act);
      group.classList.toggle("dim", open.has(inference) && inference !== act);
      group.classList.toggle("search", made.has(inference));
    });
    if (net) {
      setHits([]);
      return;
    }
    const origin = host.getBoundingClientRect();
    const k = camera().k;
    const found: Hit[] = [];
    for (const goal of v.goals) {
      const n = v.inferences.indexOf(goal.goal);
      goal.formulas.forEach((formula, position) => {
        const element = host.querySelector(`#i${n}-${position}`);
        if (!element) return;
        const r = element.getBoundingClientRect();
        found.push({
          goal: goal.goal,
          position,
          text: formulaText(formula.text),
          x: (r.left - origin.left) / k - 4,
          y: (r.top - origin.top) / k - 4,
          w: r.width / k + 8,
          h: r.height / k + 8,
        });
      });
    }
    setHits(found);
  }

  // The active goal changes without a new drawing: mark it again.
  createEffect(
    on(
      () => active(),
      () => {
        if (host.firstChild) decorate(ui.tab === "net" && netReady());
        setDrawn((n) => n + 1);
      },
      { defer: true },
    ),
  );

  const natural = () => {
    const svg = host.querySelector("svg");
    return svg ? { w: svg.width.baseVal.value, h: svg.height.baseVal.value } : { w: 0, h: 0 };
  };

  function move(next: Camera, smooth = false) {
    setGlide(smooth && !reduced());
    setCamera(next);
  }

  /** Fits the whole drawing into the stage, never larger than its own size. */
  function fitView() {
    const { w, h } = natural();
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    if (!w || !h) return;
    const k = Math.max(0.2, Math.min(1, (W - 48) / w, (H - 140) / h));
    move({ k, x: (W - w * k) / 2, y: Math.max(96, (H - h * k) / 2 + 40) });
  }

  /** Pans so that the active goal is in view (the other goals stay, dimmed). */
  function bringIntoView() {
    const goal = active();
    if (goal === undefined) return;
    const element = host.querySelector(`#i${drawingIndex(goal)}`);
    if (!element) return;
    const r = element.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    const margin = 120;
    let { x, y } = camera();
    if (r.left < s.left + 16) x += s.left + 16 - r.left;
    if (r.right > s.right - 16) x -= r.right - (s.right - 16);
    if (r.top < s.top + margin) y += s.top + margin - r.top;
    if (r.bottom > s.bottom - 16) y -= r.bottom - (s.bottom - 16);
    if (x !== camera().x || y !== camera().y) move({ ...camera(), x, y }, true);
  }

  function zoom(by: number, at?: { x: number; y: number }) {
    const c = camera();
    const k = Math.max(0.2, Math.min(4, c.k * by));
    const px = at?.x ?? stage.clientWidth / 2;
    const py = at?.y ?? stage.clientHeight / 2;
    move({ k, x: px - ((px - c.x) * k) / c.k, y: py - ((py - c.y) * k) / c.k }, !at);
  }

  createEffect(() => {
    const c = camera();
    world.style.transform = `translate(${c.x}px, ${c.y}px) scale(${c.k})`;
  });

  // The dock sits above the active goal; the popover beside the selected formula.
  createEffect(() => {
    camera();
    drawn();
    const goal = active();
    if (!dock) return;
    if (goal === undefined || ui.tab === "net" || !host.firstChild) {
      dock.style.visibility = "hidden";
      return;
    }
    const element = host.querySelector(`#i${drawingIndex(goal)}`);
    if (!element) return;
    const r = element.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    const height = dock.offsetHeight;
    const left = Math.max(8, Math.min(r.left - s.left, s.width - dock.offsetWidth - 8));
    const top = Math.max(84, r.top - s.top - height - 10);
    dock.style.visibility = "visible";
    dock.style.left = `${left}px`;
    dock.style.top = `${top}px`;
  });

  // The rule popover beside the selected formula; the split chooser under the
  // goal's row, so that every formula of the goal stays clickable; on a narrow
  // stage both sit at its bottom, as a sheet.
  createEffect(() => {
    camera();
    drawn();
    const spot = ui.split ?? ui.selected;
    if (!popover || !spot) return;
    const s = stage.getBoundingClientRect();
    const narrow = s.width < 640;
    const anchor = ui.split
      ? host.querySelector(`#i${drawingIndex(spot.goal)}`)
      : stage.querySelector<HTMLElement>(
          `.fb[data-goal="${spot.goal}"][data-position="${spot.position}"]`,
        );
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    let left: number;
    let top: number;
    if (narrow) {
      left = 8;
      top = s.height - popover.offsetHeight - 60;
    } else if (ui.split) {
      left = r.left - s.left;
      top = r.bottom - s.top + 12;
    } else {
      left = r.right - s.left + 10;
      top = r.top - s.top;
    }
    popover.style.left = `${Math.max(8, Math.min(left, s.width - popover.offsetWidth - 8))}px`;
    popover.style.top = `${Math.max(8, Math.min(top, s.height - popover.offsetHeight - 8))}px`;
  });

  // Panning by dragging the field, zooming with ctrl and the wheel, and both by buttons and keys.
  onMount(() => {
    let drag: { x: number; y: number; id: number } | null = null;
    const down = (event: PointerEvent) => {
      if ((event.target as Element).closest("button, input, .dock, .pop, .cluster")) return;
      drag = { x: event.clientX, y: event.clientY, id: event.pointerId };
      stage.setPointerCapture(event.pointerId);
      stage.dataset["panning"] = "";
    };
    const moved = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const c = camera();
      move({ ...c, x: c.x + event.clientX - drag.x, y: c.y + event.clientY - drag.y });
      drag = { ...drag, x: event.clientX, y: event.clientY };
    };
    const up = () => {
      drag = null;
      delete stage.dataset["panning"];
    };
    const wheel = (event: WheelEvent) => {
      if (!host.firstChild) return;
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const s = stage.getBoundingClientRect();
        zoom(Math.exp(-event.deltaY / 300), {
          x: event.clientX - s.left,
          y: event.clientY - s.top,
        });
      } else {
        const c = camera();
        move({ ...c, x: c.x - event.deltaX, y: c.y - event.deltaY });
      }
    };
    const resized = new ResizeObserver(() => setDrawn((n) => n + 1));
    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointermove", moved);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
    stage.addEventListener("wheel", wheel, { passive: false });
    resized.observe(stage);
    const keys = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if ((event.target as Element).closest("input, textarea, select")) return;
      if (event.key === "+" || event.key === "=") zoom(1.25);
      else if (event.key === "-") zoom(0.8);
      else if (event.key === "f") fitView();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", keys);
    onCleanup(() => {
      resized.disconnect();
      window.removeEventListener("keydown", keys);
    });
  });

  // Drops of a .json file onto the stage import it.
  const [dropping, setDropping] = createSignal(false);
  const dropped = async (event: DragEvent) => {
    event.preventDefault();
    setDropping(false);
    const file = event.dataTransfer?.files[0];
    if (!file) return;
    const outcome = await props.prover.open(await file.text());
    setUi(
      "live",
      "kind" in outcome
        ? `Imported a ${outcome.kind} from ${file.name}.`
        : `${outcome.problem.keyword}: not imported.`,
    );
  };

  /** Opens a formula's rules, or in the split chooser sends it left or right. */
  async function pick(hit: Hit) {
    const split = ui.split;
    if (split) {
      if (hit.goal !== split.goal || hit.position === split.position) return;
      const left = split.left.includes(hit.position)
        ? split.left.filter((p) => p !== hit.position)
        : [...split.left, hit.position].sort((a, b) => a - b);
      setUi("split", { ...split, left, passes: null });
      checkSplit();
      return;
    }
    props.prover.focus(hit.goal);
    props.prover.clearNote();
    setUi({ selected: { goal: hit.goal, position: hit.position }, offered: null });
    const offered = await props.prover.rules(hit.goal, hit.position);
    if (ui.selected?.goal === hit.goal && ui.selected.position === hit.position)
      setUi("offered", offered);
    queueMicrotask(() => popover?.querySelector<HTMLButtonElement>("button.rule")?.focus());
  }

  async function checkSplit() {
    const split = ui.split;
    if (!split) return;
    const step: StepForm = { position: split.position, rule: split.rule, left: split.left };
    const passes = await props.prover.splitPasses(split.goal, step);
    if (ui.split && ui.split.left === split.left && ui.split.goal === split.goal) {
      setUi("split", (s) => (s ? { ...s, passes } : s));
    }
  }

  /** A rule chosen in the popover: applied, or for a split the chooser opens. */
  async function choose(rule: Offered) {
    const spot = ui.selected;
    if (!spot) return;
    if (rule.split) {
      setUi({ split: { ...spot, rule: rule.rule, left: [], passes: null }, offered: null });
      checkSplit();
      return;
    }
    setUi({ selected: null, offered: null });
    const applied = await props.prover.apply(spot.goal, {
      position: spot.position,
      rule: rule.rule,
    });
    announce(applied, rule.rule);
  }

  async function applySplit() {
    const split = ui.split;
    if (!split) return;
    setUi({ split: null, selected: null });
    const applied = await props.prover.apply(split.goal, {
      position: split.position,
      rule: split.rule,
      left: split.left,
    });
    announce(applied, split.rule);
  }

  function announce(applied: boolean, rule: string) {
    const note = proof()?.note;
    if (applied) {
      setUi("live", proof()?.view?.complete ? "Proved: every goal is closed." : `${rule} applied.`);
    } else if (note) {
      setUi("live", `${note.said.keyword}. ${note.said.sentence}`);
      const button = stage.querySelector(".fb[data-active]");
      if (button && !reduced()) {
        button.animate(
          [
            { transform: "translateX(0)" },
            { transform: "translateX(-4px)" },
            { transform: "translateX(4px)" },
            { transform: "translateX(0)" },
          ],
          { duration: 240 },
        );
      }
    }
  }

  // Escape closes the popover or the chooser; Enter applies a split; a digit picks a rule.
  onMount(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Escape" && (ui.selected || ui.split)) {
        const spot = ui.split ?? ui.selected;
        setUi({ selected: null, offered: null, split: null });
        if (spot)
          stage
            .querySelector<HTMLElement>(
              `.fb[data-goal="${spot.goal}"][data-position="${spot.position}"]`,
            )
            ?.focus();
        event.preventDefault();
      } else if (ui.offered && /^[1-9]$/.test(event.key)) {
        const rule = ui.offered[Number(event.key) - 1];
        if (rule) {
          event.preventDefault();
          void choose(rule);
        }
      } else if (
        ui.split &&
        event.key === "Enter" &&
        !(event.target as Element).closest(".fb, button")
      ) {
        event.preventDefault();
        void applySplit();
      }
    };
    window.addEventListener("keydown", keys);
    onCleanup(() => window.removeEventListener("keydown", keys));
  });

  const note = createMemo(() => {
    const p = proof();
    const goal = active();
    if (!p?.note || !p.session) return null;
    const at = goalAt(p.session, p.note.path);
    return at === goal || (p.note.path.length === 0 && !p.view?.complete) ? p.note : null;
  });

  const currentKey = () => {
    const p = proof();
    const goal = active();
    return p?.session && goal !== undefined
      ? ladderKey(p.id, paths(p.session).get(goal) ?? [])
      : "";
  };
  const ladder = () => (ui.ladder && ui.ladder.key === currentKey() ? ui.ladder : null);
  const hintedPosition = () => {
    const l = ladder();
    return l && l.rung >= 2 ? l.hint?.steps?.[0]?.position : undefined;
  };
  const hintedLeft = () => {
    const l = ladder();
    return l && l.rung >= 3 ? (l.hint?.steps?.[0]?.left ?? []) : [];
  };

  const goalNumber = (goal: number) => goal + 1;
  const position = () => {
    const goal = active();
    const goals = view()?.goals ?? [];
    return goals.findIndex((g) => g.goal === goal) + 1;
  };

  const verdictOf = () => note()?.outcome?.verdict;

  return (
    <section
      class="stage"
      aria-label="The proof"
      ref={stage}
      data-dropping={dropping() ? "" : undefined}
      onDragOver={(event) => {
        event.preventDefault();
        setDropping(true);
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={dropped}
    >
      <div class="world" ref={world} data-glide={glide() ? "" : undefined}>
        <div class="drawing" ref={host} />
        <div class="hits">
          <For each={hits()}>
            {(hit) => (
              <button
                type="button"
                class="fb"
                data-goal={hit.goal}
                data-position={hit.position}
                data-active={hit.goal === active() ? "" : undefined}
                data-dim={hit.goal !== active() ? "" : undefined}
                data-selected={
                  ui.selected?.goal === hit.goal && ui.selected.position === hit.position
                    ? ""
                    : undefined
                }
                data-left={
                  ui.split?.goal === hit.goal && ui.split.left.includes(hit.position)
                    ? ""
                    : undefined
                }
                data-principal={
                  ui.split?.goal === hit.goal && ui.split.position === hit.position ? "" : undefined
                }
                data-hinted={
                  hit.goal === active() &&
                  (hintedPosition() === hit.position || hintedLeft().includes(hit.position))
                    ? ""
                    : undefined
                }
                aria-label={`${hit.text}, formula ${hit.position + 1} of goal ${goalNumber(hit.goal)}`}
                aria-pressed={
                  ui.split?.goal === hit.goal ? ui.split.left.includes(hit.position) : undefined
                }
                ref={(el) => {
                  el.style.left = `${hit.x}px`;
                  el.style.top = `${hit.y}px`;
                  el.style.width = `${hit.w}px`;
                  el.style.height = `${hit.h}px`;
                }}
                onClick={() => void pick(hit)}
              />
            )}
          </For>
        </div>
      </div>

      <Show when={proof()?.session}>
        <Calculus prover={props.prover} ui={props.ui} />
      </Show>

      <Show when={proof()?.banner}>
        {(banner) => (
          <p class="banner kw warn" data-tip={banner().sentence}>
            {banner().keyword}
          </p>
        )}
      </Show>

      <Show when={problem()}>
        {(text) => <p class="banner kw warn">The drawing failed: {text()}</p>}
      </Show>

      <Show when={!proof()?.session}>
        <div class="empty">
          <p>Type a sequent in the field above, then press Enter.</p>
        </div>
      </Show>

      <Show when={proof()?.view?.complete && ui.tab === "tree"}>
        <p class="done kw ok" role="status">
          Proved: every goal is closed
        </p>
      </Show>

      <div class="dock" ref={dock} data-tab={ui.tab}>
        <Show when={active() !== undefined}>
          <div class="cluster gbar">
            <button
              type="button"
              class="btn btn-s icon"
              aria-label="Previous goal"
              data-tip="Previous open goal"
              data-key="["
              onClick={() => props.prover.cycle(-1)}
              disabled={openCount() < 2}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span class="gn">
              Goal {goalNumber(active() ?? 0)} ({position()} of {openCount()} open)
            </span>
            <button
              type="button"
              class="btn btn-s icon"
              aria-label="Next goal"
              data-tip="Next open goal"
              data-key="]"
              onClick={() => props.prover.cycle(1)}
              disabled={openCount() < 2}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <span class="sep" />
            <Show
              when={props.prover.pending() === 0}
              fallback={
                <>
                  <span class="lamp run" aria-hidden="true" />
                  <span class="txt">Searching</span>
                  <button type="button" class="btn btn-s warn" onClick={() => props.prover.stop()}>
                    Stop the search
                  </button>
                </>
              }
            >
              <button
                type="button"
                class="btn btn-s"
                data-tip="The search closes this goal"
                data-key="C"
                onClick={() => {
                  const goal = active();
                  if (goal !== undefined) void props.prover.close(goal);
                }}
              >
                Close goal
              </button>
            </Show>
          </div>
          <Show when={note()}>
            {(n) => (
              <div class="cluster dline">
                <button
                  type="button"
                  class={`kw ${n().tone}`}
                  data-tip={n().said.sentence}
                  aria-label={`${n().said.keyword}: ${n().said.sentence}`}
                >
                  {n().said.keyword}
                </button>
                <Show when={verdictOf() === "unknown"}>
                  <button
                    type="button"
                    class="btn btn-s warn"
                    data-key="⇧R"
                    onClick={() => {
                      const goal = active();
                      const budget = n().budget ?? props.prover.settings().budget;
                      if (goal !== undefined)
                        void props.prover.close(
                          goal,
                          (2 * budget) / props.prover.settings().budget,
                        );
                    }}
                  >
                    Try {(2 * (n().budget ?? props.prover.settings().budget)).toLocaleString("en")}{" "}
                    units
                  </button>
                </Show>
                <Show when={n().tone === "bad"}>
                  <button type="button" class="btn btn-s" onClick={() => void props.prover.undo()}>
                    Undo
                  </button>
                </Show>
              </div>
            )}
          </Show>
          <Show when={ladder()}>
            {(l) => (
              <div class="cluster dline hint" role="status">
                <span class="rungs" role="img" aria-label={`Hint ${l().rung} of 4`}>
                  <For each={[1, 2, 3, 4]}>
                    {(r) => <i data-on={r <= l().rung ? "" : undefined} />}
                  </For>
                </span>
                <span class="txt">
                  {l().hint === null
                    ? "Asking the search"
                    : l().hint?.steps
                      ? rungs(l().hint?.steps ?? [], formulasOf(active() ?? 0))[l().rung - 1]
                      : "The search found no proof of this goal, so there is no hint: close it to see why."}
                </span>
              </div>
            )}
          </Show>
        </Show>
      </div>

      <Show when={ui.selected && !ui.split}>
        <div class="cluster pop" ref={popover} role="dialog" aria-label="Rules">
          <p class="pop-h">
            <span class="kw-label">Rules</span>
            <span class="m">
              {formulaText(
                formulasOf(ui.selected?.goal ?? 0)[ui.selected?.position ?? 0]?.text ?? "",
              )}
            </span>
          </p>
          <Show when={ui.offered} fallback={<p class="sub">Asking linlog</p>}>
            {(offered) => (
              <Show
                when={offered().length > 0}
                fallback={<p class="sub">No rule acts on this formula.</p>}
              >
                <ul class="rules">
                  <For each={offered()}>
                    {(rule, i) => (
                      <li>
                        <button type="button" class="rule" onClick={() => void choose(rule)}>
                          <span class="rn">{rule.rule}</span>
                          <span class="rd">{rule.split ? "split" : ""}</span>
                          <kbd>{i() + 1}</kbd>
                        </button>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            )}
          </Show>
        </div>
      </Show>

      <Show when={ui.split}>
        {(split) => (
          <div class="cluster pop split" ref={popover} role="dialog" aria-label="Split">
            <p class="pop-h">
              <span class="kw-label">Split</span>
              <span class="m">{split().rule}</span>
            </p>
            <p class="sub">Click the formulas that go to the left premise.</p>
            <div class="split-pre" data-fails={split().passes === false ? "" : undefined}>
              <p class="prem">
                <span class="kw-label">Left</span>
                <span class="m">
                  {formulasOf(split().goal)
                    .filter((_, i) => split().left.includes(i))
                    .map((f) => formulaText(f.text))
                    .join(", ") || "nothing else"}
                </span>
              </p>
              <p class="prem">
                <span class="kw-label">Right</span>
                <span class="m">
                  {formulasOf(split().goal)
                    .filter((_, i) => i !== split().position && !split().left.includes(i))
                    .map((f) => formulaText(f.text))
                    .join(", ") || "nothing else"}
                </span>
              </p>
            </div>
            <p class="row">
              <Show
                when={split().passes !== null}
                fallback={<span class="kw plain">Checking</span>}
              >
                <span
                  class={`kw ${split().passes ? "ok" : "warn"}`}
                  data-tip={
                    split().passes
                      ? "Both premises can still be proved, as far as linlog's quick test sees."
                      : "One premise cannot be proved however the rest goes: this split leads nowhere."
                  }
                >
                  {split().passes ? "Passes" : "Cannot close"}
                </span>
              </Show>
              <button type="button" class="btn btn-primary" onClick={() => void applySplit()}>
                Apply
              </button>
              <button
                type="button"
                class="btn"
                onClick={() => setUi({ split: null, selected: null })}
              >
                Cancel
              </button>
            </p>
          </div>
        )}
      </Show>

      <div class="cluster stage-ctl">
        <div class="tabs" role="tablist" aria-label="View">
          <button
            type="button"
            role="tab"
            class="tab"
            aria-selected={ui.tab === "tree"}
            data-tip="The derivation"
            data-key="V"
            onClick={() => setUi("tab", "tree")}
          >
            Tree
          </button>
          <button
            type="button"
            role="tab"
            class="tab"
            aria-selected={ui.tab === "net"}
            aria-disabled={!netReady()}
            data-tip={
              view()?.net
                ? `No net: ${view()?.net?.message.replace(/^not a proof net: /, "")}`
                : netReady()
                  ? "The finished proof's net"
                  : "The net is drawn once the proof is finished"
            }
            data-key="V"
            onClick={() => {
              if (netReady()) setUi("tab", "net");
            }}
          >
            Net
          </button>
        </div>
        <span class="sep" />
        <button
          type="button"
          class="btn icon"
          aria-label="Zoom out"
          data-tip="Zoom out"
          data-key="−"
          onClick={() => zoom(0.8)}
        >
          <ZoomOut size={18} aria-hidden="true" />
        </button>
        <span class="zoom-v">{Math.round(camera().k * 100)}%</span>
        <button
          type="button"
          class="btn icon"
          aria-label="Zoom in"
          data-tip="Zoom in"
          data-key="+"
          onClick={() => zoom(1.25)}
        >
          <ZoomIn size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          class="btn icon"
          aria-label="Fit the drawing"
          data-tip="Fit the drawing"
          data-key="F"
          onClick={fitView}
        >
          <Maximize size={18} aria-hidden="true" />
        </button>
      </div>

      <Show when={dropping()}>
        <div class="drop">
          <p class="kw-label">Drop a session or a sequent (.json) to import it</p>
        </div>
      </Show>
    </section>
  );
}
