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

import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  SquareArrowOutUpRight,
  ZoomIn,
  ZoomOut,
} from "lucide-solid";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { engineLabel, engineName, engineOf, engineTip } from "../lib/engines";
import {
  type CutShown,
  failure,
  type LinkShown,
  type MathFont,
  type Offered,
  type Outcome,
  type StepForm,
} from "../lib/linlog";
import { goalAt, paths, searchMade } from "../lib/steps";
import { readingOf, rungs, type Said, shown, stepLine } from "../lib/words";
import {
  type Elim,
  lookJson,
  type NetDrawing,
  type NetLook,
  type On,
  type Prover,
  pathKey,
} from "./state";
import { ladderKey, phone, token, type Ui, Words } from "./ui";

/** A formula's button over the drawing, in the drawing's own pixels. */
interface Hit {
  readonly goal: number;
  readonly position: number;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** The part of the width that is padding past the formula's ends, the same on screen at every zoom. */
  readonly fixed: number;
}

/** A cut's button over the drawing, in the drawing's own pixels: what a step names it by. */
interface CutHit {
  /** The node of a derivation's cut, or a vertex at a net's cut link. */
  readonly at: number;
  readonly formula: string;
  /** Whether the strategy reduces it next. */
  readonly next: boolean;
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

/**
 * The settings of the stage's drawing: the formulas large enough to click, in the stage's font,
 * a classical derivation two-sided where the calculus's switch asks it.
 */
const drawSettings = (
  work: number,
  essential: boolean,
  net: NetDrawing,
  look: NetLook,
  font: MathFont,
  twoSided: boolean,
  cutSteps?: number,
) =>
  JSON.stringify({
    limits: { work },
    ...(cutSteps ? { cut: { steps: cutSteps } } : {}),
    styles: { svg: { font_size: 30, essential, net, net_look: lookJson(look), font } },
    ...(twoSided ? { view: { classical: "two" } } : {}),
  });

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
  const [cutHits, setCutHits] = createSignal<CutHit[]>([]);
  /** The cut chooser's formula as typed, and what linlog said of it. */
  const [cutText, setCutText] = createSignal("");
  const [cutSaid, setCutSaid] = createSignal<Said | null>(null);
  /** The witness chooser's term as typed, and what linlog said of it. */
  const [witnessText, setWitnessText] = createSignal("");
  const [witnessSaid, setWitnessSaid] = createSignal<Said | null>(null);
  const [camera, setCamera] = createSignal<Camera>({ x: 0, y: 0, k: 1 });

  /** Whether the visitor zoomed since the drawing was last fitted: then their zoom stands. */
  let byHand = false;
  const [problem, setProblem] = createSignal<string | null>(null);
  const [glide, setGlide] = createSignal(false);
  let sequence = 0;
  /** A rule's digit typed while the popover was still asking linlog. */
  let typedEarly: number | undefined;
  let shownProof: string | undefined;
  /** What the stage drew last: the tree, or the net in one of its drawings. */
  let shownKind: string | undefined;
  /** Whether the proof drawn last was finished. */
  let shownComplete = false;

  const view = () => proof()?.view ?? null;
  const active = () => prover().activeGoal();
  // The other tabs a goal may be filled from: asked again as the goal or the tabs change.
  const [fills] = createResource(
    () =>
      [
        active(),
        props.prover.store.proofs.map((p) => `${p.id}:${p.view?.complete ?? false}`).join(),
      ] as const,
    ([goal]) => (goal === undefined ? [] : props.prover.fillable(goal)),
  );
  const openCount = () => view()?.goals.length ?? 0;
  const formulasOf = (goal: number) => view()?.goals.find((g) => g.goal === goal)?.formulas ?? [];

  /** The drawing's `i<n>` of a goal. */
  const drawingIndex = (goal: number) => view()?.inferences.indexOf(goal) ?? -1;

  const netReady = () => {
    const v = view();
    return !!v && v.complete && v.net === null;
  };

  /** The view an elimination acts on: the net while the net is shown, else the derivation. */
  const onView = (): On => (ui.tab === "net" && netReady() ? "net" : "tree");
  /** The elimination of the finished proof's cuts on the view shown, if one is under way. */
  const elim = (): Elim | null => proof()?.elim[onView()] ?? null;
  /** The settings of the stage's drawing, which an elimination's drawings are made with. */
  const drawJson = () => {
    const s = props.prover.settings();
    return drawSettings(
      s.budget,
      (proof()?.mode ?? "classical").startsWith("intuitionistic"),
      s.net,
      s.netLook,
      s.stageFont,
      s.twoSided,
      s.cutSteps,
    );
  };
  /** The drawing an elimination shows: the proof or net reached, or a step's, before it. */
  const elimDrawing = (e: Elim) =>
    e.shown === null ? e.reached.drawing : (e.taken[e.shown - 1]?.drawing ?? null);

  // A new drawing whenever the session, the tab or the proof changes.
  createEffect(
    on(
      () =>
        [
          proof()?.session,
          proof()?.view,
          ui.tab,
          props.prover.store.active,
          props.prover.settings().net,
          props.prover.settings().netLook,
          props.prover.settings().stageFont,
          props.prover.settings().twoSided,
          proof()?.elim.tree?.reached,
          proof()?.elim.tree?.shown,
          proof()?.elim.net?.reached,
          proof()?.elim.net?.shown,
        ] as const,
      async ([session, v, tab, , netDrawing, look, font, twoSided]) => {
        const mine = ++sequence;
        if (!session || !v) {
          host.replaceChildren();
          setHits([]);
          return;
        }
        const net = tab === "net" && v.complete && v.net === null;
        const eliminating = proof()?.elim[net ? "net" : "tree"] ?? null;
        let svg: string;
        try {
          if (eliminating) {
            const drawing = elimDrawing(eliminating);
            if (drawing === null) {
              const refused = eliminating.reached.refused?.message;
              throw new Error(
                JSON.stringify({
                  code: "page",
                  kind: "refused",
                  message: refused ?? "This step was not drawn: the drawings took their bound.",
                }),
              );
            }
            svg = drawing;
          } else {
            // An intuitionistic proof's net is its essential net.
            const settings = drawSettings(
              props.prover.settings().budget,
              session.mode.startsWith("intuitionistic"),
              netDrawing,
              look,
              font,
              twoSided,
            );
            svg = net
              ? await props.prover.api.drawNet(session, settings)
              : await props.prover.api.draw(session, settings);
          }
        } catch (thrown) {
          if (mine !== sequence) return;
          host.replaceChildren();
          setHits([]);
          setCutHits([]);
          setProblem(failure(thrown instanceof Error ? thrown.message : thrown).message);
          return;
        }
        if (mine !== sequence) return;
        setProblem(null);
        const hadFocus =
          stage.contains(document.activeElement) || document.activeElement === document.body;
        host.innerHTML = svg;
        decorate(net);
        // A net is drawn larger than its derivation, the compact net smaller
        // than the one with its formulas, and a look may add rows: each is
        // fitted afresh.
        const kind = `${net ? `net-${netDrawing}-${JSON.stringify(look)}` : "tree"}${eliminating ? "-cut" : ""}`;
        // A proof just finished is fitted whole, since nothing is left to work on.
        const fresh =
          shownProof !== props.prover.store.active ||
          shownKind !== kind ||
          (v.complete && !shownComplete);
        shownComplete = v.complete;
        shownProof = props.prover.store.active ?? undefined;
        shownKind = kind;
        if (fresh) fitView();
        else {
          // A step can leave the active goal's formulas narrower than a control (a
          // narrower font's more often): zoom in to the floor, unless the visitor zoomed by hand.
          const k = floor();
          if (!byHand && k > camera().k) {
            const c = camera();
            const at = { x: stage.clientWidth / 2, y: stage.clientHeight / 2 };
            move({ k, x: at.x - ((at.x - c.x) * k) / c.k, y: at.y - ((at.y - c.y) * k) / c.k });
          }
          bringIntoView();
        }
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
    const eliminating = proof()?.elim[net ? "net" : "tree"];
    if (eliminating) {
      setHits([]);
      markElimination(eliminating);
      return;
    }
    setCutHits([]);
    const open = new Set(v.goals.map((g) => g.goal));
    const made = searchMade(session);
    const act = active();
    const where = paths(session);
    const engines = proof()?.engines ?? {};
    v.inferences.forEach((inference, n) => {
      const group = host.querySelector(`#i${n}`);
      if (!group) return;
      group.classList.toggle("open-goal", open.has(inference));
      group.classList.toggle("active", inference === act);
      group.classList.toggle("dim", open.has(inference) && inference !== act);
      group.classList.toggle("search", made.has(inference));
      // Beside the rule label of a search's graft, the engine that made it.
      const engine = made.has(inference) ? engines[pathKey(where.get(inference) ?? [])] : undefined;
      const label = group.nextElementSibling;
      if (engine && !net && label instanceof SVGTextElement && !made.has(parentOf(inference))) {
        label.parentNode?.querySelector(`text.engine[data-of="${n}"]`)?.remove();
        const box = label.getBBox();
        const mark = document.createElementNS("http://www.w3.org/2000/svg", "text");
        mark.classList.add("engine");
        mark.dataset["of"] = String(n);
        mark.setAttribute("x", String(box.x + box.width + box.height / 3));
        mark.setAttribute("y", label.getAttribute("y") ?? String(box.y + box.height));
        mark.setAttribute("font-size", String(box.height * 0.6));
        mark.setAttribute("data-tip", engineTip(engine));
        mark.textContent = engineLabel(engine);
        label.after(mark);
      }
    });
    if (net) {
      setHits([]);
      return;
    }
    setHits(targets(v.goals));
  }

  /**
   * Marks an elimination's drawing: the cut a step reduced (and where it acted besides) on
   * the drawing it was taken on, and on the proof or net reached a button over every cut,
   * the strategy's next one marked.
   */
  function markElimination(e: Elim) {
    const mark = (id: string, name: string) =>
      host.querySelector(`[id="${CSS.escape(id)}"]`)?.classList.add(name);
    const step = e.shown === null ? undefined : e.taken[e.shown - 1];
    if (step) {
      for (const id of step.highlight?.cut ?? []) mark(id, "reduced");
      for (const id of step.highlight?.above ?? []) mark(id, "acted");
      setCutHits([]);
      return;
    }
    const origin = host.getBoundingClientRect();
    const k = camera().k;
    const least = token("--size-control-small") / k;
    const next = e.reached.next;
    const found: CutHit[] = [];
    for (const cut of e.reached.cuts) {
      const tree = "node" in cut;
      const ids = tree ? (cut as CutShown).inferences.map((n) => `i${n}`) : [(cut as LinkShown).id];
      const at = tree ? (cut as CutShown).node : (cut as LinkShown).ends[0];
      const isNext = tree
        ? next === at
        : Array.isArray(next) && next[0] === at && next[1] === (cut as LinkShown).ends[1];
      for (const id of ids) {
        const element = host.querySelector(`[id="${CSS.escape(id)}"]`);
        if (!element) continue;
        if (isNext) element.classList.add("next-cut");
        const r = element.getBoundingClientRect();
        const w = Math.max(r.width / k, least);
        const h = Math.max(r.height / k, least);
        found.push({
          at,
          formula: cut.formula,
          next: isNext,
          x: (r.left - origin.left) / k + r.width / k / 2 - w / 2,
          y: (r.top - origin.top) / k + r.height / k / 2 - h / 2,
          w,
          h,
        });
      }
    }
    setCutHits(found);
  }

  /** The inference whose premise an inference is, or -1 for the root. */
  function parentOf(inference: number): number {
    const all = proof()?.session?.inferences ?? [];
    return all.findIndex((i) => i.premises?.includes(inference));
  }

  /**
   * The formulas' buttons of the open goals: each covers its formula and half
   * the gap to its neighbours in the goal, so that no tap falls between two,
   * and is at least a control's height on the screen.
   */
  function targets(goals: NonNullable<ReturnType<typeof view>>["goals"]): Hit[] {
    const v = view();
    if (!v) return [];
    const origin = host.getBoundingClientRect();
    const k = camera().k;
    const least = token("--size-control-small") / k;
    const pad = token("--spacing-1") / k;
    const found: Hit[] = [];
    for (const goal of goals) {
      const n = v.inferences.indexOf(goal.goal);
      const boxes = goal.formulas.flatMap((formula, position) => {
        const element = host.querySelector(`#i${n}-${position}`);
        if (!element) return [];
        const r = element.getBoundingClientRect();
        return [
          {
            position,
            text: shown(formula),
            left: (r.left - origin.left) / k,
            right: (r.right - origin.left) / k,
            top: (r.top - origin.top) / k,
            height: r.height / k,
          },
        ];
      });
      const sorted = [...boxes].sort((a, b) => a.left - b.left);
      sorted.forEach((box, i) => {
        // Half a comma's gap to a neighbour; across a wider one (the ⊢
        // between the sides) no further than the padding.
        const before = sorted[i - 1];
        const after = sorted[i + 1];
        const near = (gap: number) => gap <= box.height / 2;
        const left =
          before && near(box.left - before.right) ? (before.right + box.left) / 2 : box.left - pad;
        const right =
          after && near(after.left - box.right) ? (box.right + after.left) / 2 : box.right + pad;
        const ends = (left === box.left - pad ? 1 : 0) + (right === box.right + pad ? 1 : 0);
        const h = Math.max(box.height + 2 * pad, least);
        found.push({
          goal: goal.goal,
          position: box.position,
          text: box.text,
          x: left,
          y: box.top + box.height / 2 - h / 2,
          w: right - left,
          h,
          fixed: ends * pad * k,
        });
      });
    }
    return found;
  }

  // A zoom changes the least size of a formula's button on the screen.
  createEffect(
    on(
      () => camera().k,
      () => {
        const e = elim();
        if (host.firstChild && e) markElimination(e);
        else if (host.firstChild && !(ui.tab === "net" && netReady()))
          setHits(targets(view()?.goals ?? []));
      },
      { defer: true },
    ),
  );

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

  /** The drawing's size, with the engines' labels that stand out past its right edge. */
  const natural = () => {
    const svg = host.querySelector("svg");
    if (!svg) return { w: 0, h: 0 };
    const left = host.getBoundingClientRect().left;
    const k = camera().k;
    const labels = [...host.querySelectorAll("text.engine")].map(
      (label) => (label.getBoundingClientRect().right - left) / k,
    );
    return { w: Math.max(svg.width.baseVal.value, ...labels), h: svg.height.baseVal.value };
  };

  function move(next: Camera, smooth = false) {
    setGlide(smooth && !reduced());
    setCamera(next);
  }

  /**
   * Fits the whole drawing into the stage, never larger than its own size,
   * and never so small that a formula of the active goal is a smaller target
   * than a control: then the active goal is shown at that size instead.
   */
  function fitView() {
    byHand = false;
    const { w, h } = natural();
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    if (!w || !h) return;
    const margin = token("--spacing-7");
    const top = token("--spacing-8");
    const fit = Math.max(0.2, Math.min(1, (W - margin) / w, (H - top - margin) / h));
    const k = Math.max(fit, floor());
    if (k > fit) {
      move({ k, x: (W - w * k) / 2, y: top });
      queueMicrotask(() => bringIntoView(false));
    } else {
      move({ k, x: (W - w * k) / 2, y: Math.max(top, (H - h * k) / 2) });
    }
  }

  /** The least zoom at which every formula of the active goal is as wide as a control. */
  function floor(): number {
    const goal = active();
    const formulas = (view()?.goals ?? []).filter((g) => g.goal === goal);
    const k = camera().k;
    const least = token("--size-control-small");
    // A button's width on screen is its formula and gaps, which scale with the zoom, and its
    // padding past the formula's ends, which does not: the zoom at which each is a control wide.
    const needed = targets(formulas).map((t) => {
      const scaled = t.w * k - t.fixed;
      return scaled > 0 ? ((least - t.fixed) / scaled) * k : 0;
    });
    const k1 = Math.max(0, ...needed);
    return Number.isFinite(k1) ? Math.min(4, k1) : 0;
  }

  /** Pans so that the active goal is in view (the other goals stay, dimmed). */
  function bringIntoView(smooth = true) {
    const goal = active();
    if (goal === undefined) return;
    const element = host.querySelector(`#i${drawingIndex(goal)}`);
    if (!element) return;
    const r = element.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    const edge = token("--spacing-4");
    const above = token("--spacing-8");
    const below = token("--spacing-8");
    let { x, y } = camera();
    // A goal wider than the stage shows its start.
    if (r.right > s.right - edge) x -= r.right - (s.right - edge);
    if (r.left - (x - camera().x) < s.left + edge) x += s.left + edge - (r.left - (x - camera().x));
    if (r.top < s.top + above) y += s.top + above - r.top;
    else if (r.bottom > s.bottom - below) y -= r.bottom - (s.bottom - below);
    if (x !== camera().x || y !== camera().y) move({ ...camera(), x, y }, smooth);
  }

  function zoom(by: number, at?: { x: number; y: number }) {
    byHand = true;
    const c = camera();
    const k = Math.max(0.2, Math.min(4, c.k * by));
    const px = at?.x ?? stage.clientWidth / 2;
    const py = at?.y ?? stage.clientHeight / 2;
    move({ k, x: px - ((px - c.x) * k) / c.k, y: py - ((py - c.y) * k) / c.k }, !at);
  }

  /** Zooms by `by` about the point `from` of the stage, which then lies at `to`: a pinch. */
  function pinch(by: number, from: { x: number; y: number }, to: { x: number; y: number }) {
    byHand = true;
    const c = camera();
    const k = Math.max(0.2, Math.min(4, c.k * by));
    move({ k, x: to.x - ((from.x - c.x) * k) / c.k, y: to.y - ((from.y - c.y) * k) / c.k });
  }

  createEffect(() => {
    const c = camera();
    world.style.transform = `translate(${c.x}px, ${c.y}px) scale(${c.k})`;
  });

  // The dock sits above the active goal; the popover beside the selected formula.
  createEffect(() => {
    camera();
    drawn();
    note();
    ladder();
    props.prover.busy();
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
    const gap = token("--spacing-2");
    const height = dock.offsetHeight;
    const left = Math.max(gap, Math.min(r.left - s.left, s.width - dock.offsetWidth - gap));
    // The goal's extent with its formulas' buttons, which reach past its text.
    const buttons = [...stage.querySelectorAll(".fb[data-active]")].map((b) =>
      b.getBoundingClientRect(),
    );
    const goalTop = Math.min(r.top, ...buttons.map((b) => b.top));
    const goalBottom = Math.max(r.bottom, ...buttons.map((b) => b.bottom));
    // Above the goal, or below it where the stage's top leaves no room.
    const above = goalTop - s.top - height - gap;
    const top = above >= gap ? above : goalBottom - s.top + gap;
    dock.style.visibility = "visible";
    dock.style.left = `${left}px`;
    dock.style.top = `${top}px`;
  });

  // A lesson's reason beside the rule label of the inference it played, with Learn on.
  const reason = () => {
    const r = ui.reason;
    return ui.learn && r && proof()?.id === r.tab ? r : null;
  };
  const [because, setBecause] = createSignal<HTMLElement>();
  createEffect(() => {
    camera();
    drawn();
    const r = reason();
    const box = because();
    const session = proof()?.session;
    if (!box) return;
    const at = r && session ? goalAt(session, r.path) : undefined;
    const label =
      at === undefined ? null : host.querySelector(`#i${drawingIndex(at)}`)?.nextElementSibling;
    // The rule label is a text, or a group where its name has a subscript (⊕₁, &L₂).
    if (!(label instanceof SVGGraphicsElement) || ui.tab === "net") {
      box.style.visibility = "hidden";
      return;
    }
    const l = label.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    const d = host.firstElementChild?.getBoundingClientRect() ?? l;
    const gap = token("--spacing-2");
    // On the rule label's row, past the drawing's right edge so that it covers no goal; where
    // the stage has no room there, under the drawing, below the label; on a phone's narrow
    // stage, above the stage's controls.
    const beside = Math.max(l.right, d.right) - s.left + gap;
    const fits = beside + box.offsetWidth <= s.width - gap;
    const controls = stage.querySelector(".stage-ctl")?.getBoundingClientRect();
    const x = fits ? beside : phone() ? gap : l.left - s.left;
    const y = fits
      ? l.top + l.height / 2 - s.top - box.offsetHeight / 2
      : phone() && controls
        ? controls.top - s.top - box.offsetHeight - gap
        : d.bottom - s.top + gap;
    const left = Math.max(gap, Math.min(x, s.width - box.offsetWidth - gap));
    const top = Math.max(gap, Math.min(y, s.height - box.offsetHeight - gap));
    box.style.visibility = "visible";
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
  });

  // The rule popover beside the selected formula; the split and cut choosers
  // under the goal's row, so that every formula of the goal stays clickable; on
  // a narrow stage each sits at its bottom, as a sheet.
  createEffect(() => {
    camera();
    drawn();
    void ui.offered;
    void ui.cutting?.left;
    void cutSaid();
    void witnessSaid();
    const under = ui.split ?? ui.cutting ?? ui.witnessing;
    const selected = ui.selected;
    const goal = under?.goal ?? selected?.goal;
    if (!popover || goal === undefined) return;
    const s = stage.getBoundingClientRect();
    const narrow = phone();
    const gap = token("--spacing-2");
    const anchor = under
      ? host.querySelector(`#i${drawingIndex(goal)}`)
      : stage.querySelector<HTMLElement>(
          `.fb[data-goal="${goal}"][data-position="${selected?.position}"]`,
        );
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    let left: number;
    let top: number;
    if (narrow) {
      // A sheet at the stage's bottom, above its controls.
      const controls = stage.querySelector<HTMLElement>(".stage-ctl")?.offsetTop ?? s.height;
      left = gap;
      top = controls - popover.offsetHeight - gap;
    } else if (under) {
      left = r.left - s.left;
      top = r.bottom - s.top + gap;
    } else {
      left = r.right - s.left + gap;
      top = r.top - s.top;
    }
    popover.style.left = `${Math.max(gap, Math.min(left, s.width - popover.offsetWidth - gap))}px`;
    popover.style.top = `${Math.max(gap, Math.min(top, s.height - popover.offsetHeight - gap))}px`;
  });

  // Panning by dragging the field, zooming by a pinch (two fingers, or a trackpad's pinch, which
  // browsers send as ctrl and the wheel or, in Safari, as gesture events) and by ctrl and the
  // wheel about where it happens, and both by buttons and keys. The stage takes no gesture of the
  // browser's (touch-action: none), so a pinch here zooms the drawing, never the page; everywhere
  // else the browser's own zoom acts, and ctrl with plus or minus is always the browser's.
  onMount(() => {
    // The pointers down on the stage: one on the field pans; a second finger, wherever it lands,
    // makes a pinch of the two.
    const pointers = new Map<number, { x: number; y: number; pans: boolean }>();
    const down = (event: PointerEvent) => {
      const control = (event.target as Element).closest("button, input, .dock, .pop, .cluster");
      if (control && (event.pointerType !== "touch" || pointers.size === 0)) {
        if (event.pointerType === "touch")
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, pans: false });
        return;
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, pans: true });
      stage.setPointerCapture(event.pointerId);
      stage.dataset["panning"] = "";
    };
    const moved = (event: PointerEvent) => {
      const was = pointers.get(event.pointerId);
      if (!was) return;
      const now = { ...was, x: event.clientX, y: event.clientY };
      const other = [...pointers].find(([id]) => id !== event.pointerId)?.[1];
      pointers.set(event.pointerId, now);
      if (pointers.size === 2 && other) {
        const s = stage.getBoundingClientRect();
        const from = { x: (was.x + other.x) / 2 - s.left, y: (was.y + other.y) / 2 - s.top };
        const to = { x: (now.x + other.x) / 2 - s.left, y: (now.y + other.y) / 2 - s.top };
        const apart = Math.hypot(was.x - other.x, was.y - other.y);
        if (apart > 0) pinch(Math.hypot(now.x - other.x, now.y - other.y) / apart, from, to);
      } else if (pointers.size === 1 && was.pans) {
        const c = camera();
        move({ ...c, x: c.x + now.x - was.x, y: c.y + now.y - was.y });
      }
    };
    const up = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size === 0) delete stage.dataset["panning"];
    };
    // Safari's pinch on a trackpad: the scale since the gesture began. On a touch screen the
    // pointers make the pinch, so their gesture events are only kept from the page.
    let scaled = 1;
    const gesture = (event: Event) => {
      event.preventDefault();
      if (pointers.size > 0) return;
      const { scale, clientX, clientY } = event as Event & {
        scale: number;
        clientX: number;
        clientY: number;
      };
      if (event.type === "gesturestart") scaled = 1;
      const s = stage.getBoundingClientRect();
      const at = { x: clientX - s.left, y: clientY - s.top };
      pinch(scale / scaled, at, at);
      scaled = scale;
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
    // The dock grows when its note or hint wraps: place it again.
    if (dock) resized.observe(dock);
    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointermove", moved);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
    stage.addEventListener("wheel", wheel, { passive: false });
    for (const type of ["gesturestart", "gesturechange"]) stage.addEventListener(type, gesture);
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
    const cutting = ui.cutting;
    if (cutting) {
      if (hit.goal !== cutting.goal) return;
      const left = cutting.left.includes(hit.position)
        ? cutting.left.filter((p) => p !== hit.position)
        : [...cutting.left, hit.position].sort((a, b) => a - b);
      setUi("cutting", { ...cutting, left });
      return;
    }
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
    // Another formula picked: the witness chooser gives way to its rules.
    setUi({
      selected: { goal: hit.goal, position: hit.position },
      offered: null,
      witnessing: null,
    });
    const offered = await props.prover.rules(hit.goal, hit.position);
    if (ui.selected?.goal !== hit.goal || ui.selected.position !== hit.position) return;
    setUi("offered", offered);
    // A digit typed before the rules arrived picks its rule now.
    const early = typedEarly;
    typedEarly = undefined;
    const rule = early === undefined ? undefined : offered[early - 1];
    if (rule) {
      void choose(rule);
      return;
    }
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
    if (rule.witness) {
      setWitnessText("");
      setWitnessSaid(null);
      setUi({
        witnessing: { goal: spot.goal, position: spot.position, rule: rule.rule },
        selected: null,
        offered: null,
      });
      queueMicrotask(() => popover?.querySelector<HTMLInputElement>("input")?.focus());
      return;
    }
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
    announce(applied === true, rule.rule);
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
    announce(applied === true, split.rule);
  }

  /**
   * Takes the quantifier step the witness chooser holds, with the term typed or, `open`, its
   * witness left for an axiom or the search to fill; what linlog refused stays said in it.
   */
  async function applyWitness(open: boolean) {
    const w = ui.witnessing;
    const text = witnessText().trim();
    if (!w || (!open && text === "")) return;
    const said = await props.prover.witnessed(w.goal, {
      position: w.position,
      rule: w.rule,
      ...(open ? {} : { witness: text }),
    });
    if (said === undefined) return;
    if (said) {
      setWitnessSaid(said);
      setUi("live", `${said.keyword}. ${said.sentence}`);
      return;
    }
    setUi("witnessing", null);
    setWitnessText("");
    announce(true, w.rule);
  }

  /** Opens the cut chooser at a goal. */
  function openCut(goal: number) {
    props.prover.clearNote();
    setCutSaid(null);
    setUi({ selected: null, offered: null, split: null, cutting: { goal, left: [] } });
    queueMicrotask(() => popover?.querySelector<HTMLInputElement>("input")?.focus());
  }

  /** Makes the cut the chooser holds; what linlog refused stays said in it. */
  async function applyCut() {
    const cutting = ui.cutting;
    if (!cutting || cutText().trim() === "") return;
    const said = await props.prover.cut(cutting.goal, cutText(), cutting.left);
    if (said === undefined) return;
    if (said) {
      setCutSaid(said);
      setUi("live", `${said.keyword}. ${said.sentence}`);
      return;
    }
    setUi("cutting", null);
    setCutText("");
    setUi("live", "cut applied: both premises are open.");
  }

  /** Takes one step of the elimination shown: the cut `at`, or the strategy's. */
  async function eliminationStep(at?: number) {
    const before = elim()?.taken.length ?? 0;
    await props.prover.eliminationStep(onView(), at, drawJson());
    const e = elim();
    const step = e?.taken.at(-1);
    if (e && step && e.taken.length > before) setUi("live", stepLine(e.taken.length, step));
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
            { transform: "translateX(calc(-1 * var(--spacing-1)))" },
            { transform: "translateX(var(--spacing-1))" },
            { transform: "translateX(0)" },
          ],
          { duration: token("--duration-shake") },
        );
      }
    }
  }

  // Escape closes the popover or the chooser; Enter applies a split; a digit picks a rule.
  onMount(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Escape" && ui.cutting) {
        setUi("cutting", null);
        event.preventDefault();
      } else if (event.key === "Escape" && ui.witnessing) {
        const w = ui.witnessing;
        setUi("witnessing", null);
        stage
          .querySelector<HTMLElement>(`.fb[data-goal="${w.goal}"][data-position="${w.position}"]`)
          ?.focus();
        event.preventDefault();
      } else if (event.key === "Escape" && (ui.selected || ui.split)) {
        const spot = ui.split ?? ui.selected;
        setUi({ selected: null, offered: null, split: null });
        if (spot)
          stage
            .querySelector<HTMLElement>(
              `.fb[data-goal="${spot.goal}"][data-position="${spot.position}"]`,
            )
            ?.focus();
        event.preventDefault();
      } else if (ui.selected && !ui.split && !ui.witnessing && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        if (!ui.offered) {
          typedEarly = Number(event.key);
          return;
        }
        const rule = ui.offered[Number(event.key) - 1];
        if (rule) void choose(rule);
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
                  (ui.split?.goal === hit.goal && ui.split.left.includes(hit.position)) ||
                  (ui.cutting?.goal === hit.goal && ui.cutting.left.includes(hit.position))
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
                data-tip={ui.learn ? readingOf(hit.text) : undefined}
                aria-pressed={
                  ui.split?.goal === hit.goal
                    ? ui.split.left.includes(hit.position)
                    : ui.cutting?.goal === hit.goal
                      ? ui.cutting.left.includes(hit.position)
                      : undefined
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
          <For each={cutHits()}>
            {(hit) => (
              <button
                type="button"
                class="cb"
                data-next={hit.next ? "" : undefined}
                aria-label={`Reduce the cut of ${hit.formula}${hit.next ? ", the strategy's next" : ""}`}
                data-tip={`Reduce this cut of ${hit.formula}`}
                disabled={props.prover.busy()}
                ref={(el) => {
                  el.style.left = `${hit.x}px`;
                  el.style.top = `${hit.y}px`;
                  el.style.width = `${hit.w}px`;
                  el.style.height = `${hit.h}px`;
                }}
                onClick={() => void eliminationStep(hit.at)}
              />
            )}
          </For>
        </div>
      </div>

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
          <p>
            Type a sequent, or open one from{" "}
            <button
              type="button"
              class="linkish"
              onClick={() => props.ui.setUi("menu", "practice")}
            >
              Practice
            </button>
            .
          </p>
        </div>
      </Show>

      <Show when={proof()?.view?.complete && ui.tab === "tree"}>
        <p class="done kw ok" role="status">
          Proved: every goal is closed
        </p>
      </Show>

      <Show when={reason()}>
        {(r) => (
          <p class="because" ref={setBecause} role="note" aria-label="Why this step">
            <Words text={r().text} />
          </p>
        )}
      </Show>

      <Show when={view()?.complete && ((view()?.cuts.length ?? 0) > 0 || elim())}>
        <section class="cluster elim" aria-label="Cut elimination">
          <Show
            when={elim()}
            fallback={
              <div class="row">
                <span class="txt">
                  {view()?.cuts.length === 1 ? "1 cut" : `${view()?.cuts.length} cuts`} in this
                  proof
                </span>
                <button
                  type="button"
                  class="btn btn-s btn-primary"
                  data-tip={
                    onView() === "net"
                      ? "Reduce the cut links of the net step by step"
                      : "Reduce the cuts of the derivation step by step"
                  }
                  disabled={props.prover.busy()}
                  onClick={() => void props.prover.eliminate(onView(), drawJson())}
                >
                  Eliminate the cuts
                </button>
              </div>
            }
          >
            {(e) => (
              <>
                <p class="kw-label h">Cut elimination{onView() === "net" ? " on the net" : ""}</p>
                <p class="line" role="status" aria-live="polite">
                  {(() => {
                    const shownStep = e().shown;
                    const step = shownStep === null ? undefined : e().taken[shownStep - 1];
                    if (step && shownStep !== null) return `Before ${stepLine(shownStep, step)}`;
                    const last = e().taken.at(-1);
                    const left = e().reached.cuts.length;
                    const count =
                      left === 0 ? "Cut-free" : `${left} ${left === 1 ? "cut" : "cuts"} left`;
                    return last ? `${stepLine(e().taken.length, last)} · ${count}` : count;
                  })()}
                </p>
                <Show
                  when={
                    ui.learn && e().shown === null
                      ? ui.cases?.[e().taken.at(-1)?.case ?? ""]
                      : undefined
                  }
                >
                  {(text) => (
                    <p class="line case-why" role="note" aria-label="Why this elimination step">
                      <Words text={text()} />
                    </p>
                  )}
                </Show>
                <Show when={e().stopped}>
                  {(said) => (
                    <p class="line warn" role="alert">
                      <span class="kw">{said().keyword}</span> {said().sentence}
                    </p>
                  )}
                </Show>
                <Show when={e().undrawn}>
                  {(k) => (
                    <p class="line sub">
                      Steps from {k()} on are not drawn: their drawings would take more than the
                      page keeps.
                    </p>
                  )}
                </Show>
                <Show when={e().problem}>
                  {(said) => (
                    <p class="line warn" role="alert">
                      <span class="kw">{said().keyword}</span> {said().sentence}
                    </p>
                  )}
                </Show>
                <div class="row">
                  <button
                    type="button"
                    class="btn btn-s btn-primary"
                    data-tip="The next step of the strategy: the cut with no cut above it"
                    disabled={props.prover.busy() || e().reached.next === null}
                    onClick={() => void eliminationStep()}
                  >
                    Next step
                  </button>
                  <button
                    type="button"
                    class="btn btn-s"
                    data-tip="Every step to the cut-free proof, within the bounds of Settings"
                    disabled={props.prover.busy() || e().reached.next === null}
                    onClick={() => void props.prover.eliminationRun(onView(), drawJson())}
                  >
                    To the end
                  </button>
                  <button
                    type="button"
                    class="btn btn-s"
                    data-tip="Take the last step back"
                    disabled={props.prover.busy() || e().back.length === 0}
                    onClick={() => void props.prover.eliminationUndo(onView(), drawJson())}
                  >
                    Undo step
                  </button>
                  <Show when={e().taken.length > 0}>
                    <button
                      type="button"
                      class="btn btn-s"
                      aria-pressed={e().shown !== null}
                      data-tip="The drawing before the last step, its cut marked"
                      onClick={() =>
                        props.prover.eliminationShow(
                          onView(),
                          e().shown === null ? e().taken.length : null,
                        )
                      }
                    >
                      Before
                    </button>
                  </Show>
                  <button
                    type="button"
                    class="btn btn-s"
                    data-tip="Back to the finished proof"
                    onClick={() => props.prover.eliminationLeave(onView())}
                  >
                    Leave
                  </button>
                </div>
                <Show when={e().taken.length > 1}>
                  <details class="steps-taken">
                    <summary>{e().taken.length} steps</summary>
                    <ol>
                      <For
                        each={e().taken.flatMap((step, i) =>
                          step.drawing === null ? [] : [{ step, k: i + 1 }],
                        )}
                      >
                        {(drawn) => (
                          <li>
                            <button
                              type="button"
                              class="mi"
                              aria-pressed={e().shown === drawn.k}
                              onClick={() =>
                                props.prover.eliminationShow(
                                  onView(),
                                  e().shown === drawn.k ? null : drawn.k,
                                )
                              }
                            >
                              {stepLine(drawn.k, drawn.step)}
                            </button>
                          </li>
                        )}
                      </For>
                    </ol>
                    <Show when={e().undrawn}>
                      {(k) => (
                        <p class="sub">
                          Steps {k()} to {e().taken.length} are not drawn: their drawings would take
                          more than the page keeps.
                        </p>
                      )}
                    </Show>
                  </details>
                </Show>
              </>
            )}
          </Show>
        </section>
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
              <ChevronLeft aria-hidden="true" />
            </button>
            <span class="gn">
              Goal {goalNumber(active() ?? 0)} · {openCount()} open
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
              <ChevronRight aria-hidden="true" />
            </button>
            <span class="sep" />
            <Show
              when={!props.prover.busy()}
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
              <button
                type="button"
                class="btn btn-s"
                data-tip="Cut this goal on a formula you type: two premises, one proving it, one using it"
                aria-expanded={ui.cutting !== null}
                onClick={() => {
                  const goal = active();
                  if (goal !== undefined) openCut(goal);
                }}
              >
                Cut
              </button>
              <button
                type="button"
                class="btn btn-s icon"
                aria-label="Open this goal in a new tab"
                data-tip="Open this goal in a new tab, as a proof of its own"
                onClick={() => {
                  const goal = active();
                  if (goal !== undefined) void props.prover.openGoal(goal);
                }}
              >
                <SquareArrowOutUpRight aria-hidden="true" />
              </button>
            </Show>
          </div>
          <Show when={!props.prover.busy() && (fills() ?? []).length > 0}>
            <div class="cluster dline">
              <For each={fills()}>
                {(f) => (
                  <button
                    type="button"
                    class="btn btn-s"
                    data-tip={`The tab of ${f.tab} holds a finished proof of this goal's formulas: graft it here as one step`}
                    onClick={() => {
                      const goal = active();
                      if (goal !== undefined) void props.prover.fill(goal, f.id);
                    }}
                  >
                    Fill from <span class="m">{f.tab}</span>
                  </button>
                )}
              </For>
            </div>
          </Show>
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
                <EngineChip outcome={n().outcome} ui={props.ui} />
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
                <Show when={n().tone === "bad" && !n().outcome}>
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
                      ? rungs(
                          l().hint?.steps ?? [],
                          formulasOf(active() ?? 0),
                          l().hint?.invertible === true,
                          props.prover.settings().invertible,
                        )[l().rung - 1]
                      : "The search found no proof of this goal, so there is no hint: close it to see why."}
                </span>
                <EngineChip outcome={l().hint?.outcome} ui={props.ui} />
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
              {(() => {
                const formula = formulasOf(ui.selected?.goal ?? 0)[ui.selected?.position ?? 0];
                return formula ? shown(formula) : "";
              })()}
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
                        <button
                          type="button"
                          class="rule"
                          data-rule={ui.learn ? rule.rule : undefined}
                          onClick={() => void choose(rule)}
                        >
                          <span class="rn">{rule.rule}</span>
                          <span class="rd">
                            {rule.split ? "split" : rule.witness ? "witness" : ""}
                          </span>
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

      <Show when={ui.witnessing}>
        {(w) => (
          <div class="cluster pop split cut" ref={popover} role="dialog" aria-label="Witness">
            <p class="pop-h">
              <span class="kw-label">
                Witness for <span class="m">{w().rule}</span>
              </span>
              <span class="m">
                {(() => {
                  const formula = formulasOf(w().goal)[w().position];
                  return formula ? shown(formula) : "";
                })()}
              </span>
            </p>
            <label class="cut-field">
              <span class="sub">
                Witness: a term of the sequent's constants and function symbols, and of the
                eigenvariables made below this goal, such as <span class="m">f(a)</span>
              </span>
              <input
                class="field m"
                type="text"
                spellcheck={false}
                autocomplete="off"
                aria-invalid={witnessSaid() ? "true" : undefined}
                value={witnessText()}
                onInput={(event) => {
                  setWitnessText(event.currentTarget.value);
                  setWitnessSaid(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void applyWitness(false);
                  }
                }}
              />
            </label>
            <Show when={witnessSaid()}>
              {(said) => (
                <p class="sub warn" role="alert">
                  <span class="kw">{said().keyword}</span> {said().sentence}
                </p>
              )}
            </Show>
            <p class="sub">
              Or leave it open: the goal holds <span class="m">$1</span> until an axiom or the
              search fills it.
            </p>
            <p class="row">
              <button
                type="button"
                class="btn btn-primary"
                disabled={witnessText().trim() === "" || props.prover.busy()}
                onClick={() => void applyWitness(false)}
              >
                Apply
              </button>
              <button
                type="button"
                class="btn"
                disabled={props.prover.busy()}
                onClick={() => void applyWitness(true)}
              >
                Leave open
              </button>
              <button type="button" class="btn" onClick={() => setUi("witnessing", null)}>
                Cancel
              </button>
            </p>
          </div>
        )}
      </Show>

      <Show when={ui.cutting}>
        {(cutting) => {
          const rest = () =>
            formulasOf(cutting().goal)
              .filter((_, i) => !cutting().left.includes(i))
              .map(shown);
          const chosen = () =>
            formulasOf(cutting().goal)
              .filter((_, i) => cutting().left.includes(i))
              .map(shown);
          return (
            <div class="cluster pop split cut" ref={popover} role="dialog" aria-label="Cut">
              <p class="pop-h">
                <span class="kw-label">Cut</span>
              </p>
              <label class="cut-field">
                <span class="sub">
                  The cut formula, written as{" "}
                  {(proof()?.mode ?? "").startsWith("intuitionistic")
                    ? "in intuitionistic logic"
                    : "in this tab"}
                </span>
                <input
                  class="field m"
                  type="text"
                  spellcheck={false}
                  autocomplete="off"
                  aria-invalid={cutSaid() ? "true" : undefined}
                  value={cutText()}
                  onInput={(event) => {
                    setCutText(event.currentTarget.value);
                    setCutSaid(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void applyCut();
                    }
                  }}
                />
              </label>
              <Show when={cutSaid()}>
                {(said) => (
                  <p class="sub warn" role="alert">
                    <span class="kw">{said().keyword}</span> {said().sentence}
                  </p>
                )}
              </Show>
              <p class="sub">Choose the goal's formulas that go to the premise proving it.</p>
              <div class="split-pre">
                <p class="prem">
                  <span class="kw-label">Proves</span>
                  <span class="m">{chosen().join(", ") || "from nothing else"}</span>
                </p>
                <p class="prem">
                  <span class="kw-label">Uses</span>
                  <span class="m">{rest().join(", ") || "with nothing else"}</span>
                </p>
              </div>
              <p class="row">
                <button
                  type="button"
                  class="btn btn-primary"
                  disabled={cutText().trim() === "" || props.prover.busy()}
                  onClick={() => void applyCut()}
                >
                  Cut
                </button>
                <button type="button" class="btn" onClick={() => setUi("cutting", null)}>
                  Cancel
                </button>
              </p>
            </div>
          );
        }}
      </Show>

      <Show when={ui.split}>
        {(split) => (
          <div class="cluster pop split" ref={popover} role="dialog" aria-label="Split">
            <p class="pop-h">
              <span class="kw-label">
                Split for <span class="m">{split().rule}</span>
              </span>
            </p>
            <p class="sub">Choose the formulas that go to the left premise.</p>
            <div class="split-pre" data-fails={split().passes === false ? "" : undefined}>
              <p class="prem">
                <span class="kw-label">Left</span>
                <span class="m">
                  {formulasOf(split().goal)
                    .filter((_, i) => split().left.includes(i))
                    .map(shown)
                    .join(", ") || "nothing else"}
                </span>
              </p>
              <p class="prem">
                <span class="kw-label">Right</span>
                <span class="m">
                  {formulasOf(split().goal)
                    .filter((_, i) => i !== split().position && !split().left.includes(i))
                    .map(shown)
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
                  class={`kw flat ${split().passes ? "acc" : "warn"}`}
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
          <ZoomOut aria-hidden="true" />
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
          <ZoomIn aria-hidden="true" />
        </button>
        <button
          type="button"
          class="btn icon"
          aria-label="Fit the drawing"
          data-tip="Fit the drawing"
          data-key="F"
          onClick={fitView}
        >
          <Maximize aria-hidden="true" />
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

/**
 * The engine whose work a note or a hint is, by name: its source on hover,
 * and a press opens Learn's reference at it.
 */
export function EngineChip(props: { outcome: Outcome | undefined | null; ui: Ui }) {
  return (
    <Show when={engineOf(props.outcome)}>
      {(engine) => (
        <button
          type="button"
          class="kw engine"
          data-tip={engineTip(engine())}
          aria-label={`By the ${engineName(engine())}: its source in Learn's reference`}
          onClick={() => {
            props.ui.setUi({ learn: "reference", spot: `engine-${engine()}` });
          }}
        >
          {engineLabel(engine())}
        </button>
      )}
    </Show>
  );
}
