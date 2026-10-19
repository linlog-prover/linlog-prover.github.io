// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The tour of the page: started by the visitor alone, a caption that walks
 * through its stops, each pointing at a part of the page and performing a
 * real step on `A ⊗ B ⊢ B ⊗ A` as the visitor reaches it (a stop's `act`),
 * so that the tour ends on a checked proof. Each step is performed once, on
 * the way forward; Back only moves the caption. It goes by keyboard (the
 * caption takes the focus, Esc ends it), says each stop in the live region,
 * and has no motion of its own.
 */

import { X } from "lucide-solid";
import { createEffect, on, onCleanup, Show } from "solid-js";
import type { Example, Stop } from "../lib/content";
import { Written } from "./Learn";
import type { Prover } from "./state";
import type { Ui } from "./ui";

/** The sequent the tour proves: README's first example. */
export const TOUR_EXAMPLE: Example = {
  id: "tour",
  title: "Tensor commutes",
  sequent: "A * B |- B * A",
  mode: "classical",
  difficulty: 1,
  verdict: "provable",
  session: null,
};

/** The element a stop points at. */
const SPOTS: Record<Stop["target"], string> = {
  tab: '.ptab[aria-current="true"]',
  stage: ".stage",
  formula: ".stage .fb",
  goal: ".dock",
  status: '.ptab[aria-current="true"] .dot-b',
  bottom: ".band.bottom",
};

export function Tour(props: { prover: Prover; ui: Ui; stops: readonly Stop[] }) {
  const { ui, setUi } = props.ui;
  let box: HTMLDivElement | undefined;
  let next: HTMLButtonElement | undefined;
  /** The last stop whose step was performed. */
  let acted = -1;

  const stop = () => (ui.tour === null ? undefined : props.stops[ui.tour]);

  async function act(s: Stop) {
    const p = props.prover;
    const goal = p.activeGoal();
    if (s.act === "start") await p.example(TOUR_EXAMPLE, false);
    else if (s.act === "par" && goal !== undefined) await p.apply(goal, { position: 0, rule: "⅋" });
    else if (s.act === "split" && goal !== undefined)
      await p.apply(goal, { position: 2, rule: "⊗", left: [1] });
    else if (s.act === "close") await p.closeAll();
  }

  /** Marks the stop's element and puts the caption beside it. */
  function place() {
    for (const el of document.querySelectorAll("[data-tour-spot]"))
      el.removeAttribute("data-tour-spot");
    const s = stop();
    if (!s || !box) return;
    const spot = document.querySelector<HTMLElement>(SPOTS[s.target]);
    const width = box.offsetWidth;
    const height = box.offsetHeight;
    let x = 16;
    let y = 60;
    if (spot) {
      spot.dataset["tourSpot"] = "";
      const r = spot.getBoundingClientRect();
      if (r.height > window.innerHeight / 2) {
        x = r.left + 16;
        y = r.top + 16;
      } else if (s.target === "goal" || s.target === "formula") {
        // Beside the goal, never over the formulas it points at.
        x = r.right + 12 + width <= window.innerWidth ? r.right + 12 : r.left - width - 12;
        y = r.top;
      } else {
        x = r.left;
        y = r.bottom + 8 + height <= window.innerHeight ? r.bottom + 8 : r.top - height - 8;
      }
    }
    box.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`;
    box.style.top = `${Math.max(8, Math.min(y, window.innerHeight - height - 8))}px`;
  }

  async function go(n: number) {
    setUi("tour", n);
    for (let i = acted + 1; i <= n; i++) {
      const s = props.stops[i];
      if (s) await act(s);
    }
    acted = Math.max(acted, n);
    const s = props.stops[n];
    if (s) setUi("live", `Tour, stop ${n + 1} of ${props.stops.length}: ${s.title}.`);
    // The drawing settles after the step; the caption follows it.
    requestAnimationFrame(() => {
      place();
      next?.focus();
    });
  }

  function end() {
    setUi("tour", null);
  }

  createEffect(
    on(
      () => ui.tour,
      (n, previous) => {
        if (n === null) {
          acted = -1;
          for (const el of document.querySelectorAll("[data-tour-spot]"))
            el.removeAttribute("data-tour-spot");
        } else if (n === 0 && previous === null) void go(0);
      },
    ),
  );

  const resize = () => place();
  window.addEventListener("resize", resize);
  onCleanup(() => window.removeEventListener("resize", resize));

  return (
    <Show when={stop()}>
      {(s) => (
        <div
          class="cluster tour"
          role="dialog"
          aria-label="Tour"
          ref={box}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              end();
            }
          }}
        >
          <p class="kw-label tour-h">
            <span>
              {s().title}
              <span class="sub">
                {" "}
                ({(ui.tour ?? 0) + 1} of {props.stops.length})
              </span>
            </span>
            <button type="button" class="btn icon" aria-label="End the tour" onClick={end}>
              <X size={14} aria-hidden="true" />
            </button>
          </p>
          <Show keyed when={s().id}>
            {(id) => <Written name={`tour/${id}`} />}
          </Show>
          <p class="row">
            <button
              type="button"
              class="btn btn-s"
              disabled={ui.tour === 0 || props.prover.busy()}
              onClick={() => void go((ui.tour ?? 1) - 1)}
            >
              Back
            </button>
            <Show
              when={(ui.tour ?? 0) < props.stops.length - 1}
              fallback={
                <button type="button" class="btn btn-s btn-primary" ref={next} onClick={end}>
                  Done
                </button>
              }
            >
              <button
                type="button"
                class="btn btn-s btn-primary"
                ref={next}
                disabled={props.prover.busy()}
                onClick={() => void go((ui.tour ?? 0) + 1)}
              >
                Next
              </button>
            </Show>
          </p>
        </div>
      )}
    </Show>
  );
}
