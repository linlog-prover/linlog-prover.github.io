// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * Learn: a frame around the window, on only when the visitor turns it on,
 * holding two places. The tutorial (its opening, the tour of the page, and
 * the lessons, each with its practice: problems of the store, proved by the
 * visitor or watched step by step, provable and not mixed; the lessons'
 * worked examples come when they are written) and the reference (the
 * connectives). The texts are the page's written content, cloned from its
 * templates, with their licence.
 */

import { Compass, Play, X } from "lucide-solid";
import { createEffect, For, Match, Show, Switch } from "solid-js";
import { type Example, type Level, written } from "../lib/content";
import { LEVEL_NAMES } from "../lib/practice";
import { displayed } from "../lib/words";
import type { Prover } from "./state";
import type { Rubric, Ui } from "./ui";

/**
 * A written text of the page, by its template's name; `spot`, the id of an
 * element in it, is brought into view and marked.
 */
export function Written(props: { name: string; class?: string; spot?: string | null }) {
  let host!: HTMLDivElement;
  createEffect(() => {
    const spot = props.spot;
    queueMicrotask(() => {
      for (const marked of host.querySelectorAll("[data-highlight]"))
        marked.removeAttribute("data-highlight");
      const at = spot ? host.querySelector<HTMLElement>(`#${CSS.escape(spot)}`) : null;
      if (!at) return;
      at.dataset["highlight"] = "";
      at.scrollIntoView({ block: "center" });
    });
  });
  return (
    <div
      class={`written ${props.class ?? ""}`}
      ref={(el) => {
        host = el;
        queueMicrotask(() => el.replaceChildren(written(props.name)));
      }}
    />
  );
}

/** The lessons to come, in their order: the places of the tutorial. */
export const LESSONS = [
  "Reading a sequent",
  "The multiplicatives",
  "The additives",
  "The units",
  "The exponentials",
  "Two sides",
  "When there is no proof",
  "Proof nets",
  "Ordinary logic through the translations",
] as const;

const RUBRICS: readonly (readonly [Rubric, string])[] = [
  ["tutorial", "Tutorial"],
  ["reference", "Reference"],
];

/** A level drawn as a stair of four steps, the first `level` of them filled; its name says it in words. */
export function Stairs(props: { level: Level }) {
  return (
    <span class="stairs" data-level={props.level} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

export function LearnFrame(props: {
  prover: Prover;
  ui: Ui;
  examples: readonly Example[];
  tour: () => void;
}) {
  const { ui, setUi } = props.ui;
  return (
    <aside class="frame" aria-label="Learn">
      <div class="frame-head">
        <span class="frame-mark">Learn</span>
        <div class="ftabs" role="tablist" aria-label="Learn">
          <For each={RUBRICS}>
            {([rubric, label]) => (
              <button
                type="button"
                role="tab"
                class="ftab"
                id={`ftab-${rubric}`}
                aria-controls="frame-panel"
                aria-selected={ui.learn === rubric}
                onClick={() => setUi({ learn: rubric, spot: null })}
              >
                {label}
              </button>
            )}
          </For>
        </div>
        <span class="grow" />
        <button
          type="button"
          class="btn icon"
          aria-label="Turn Learn off"
          data-tip="Turn Learn off"
          onClick={() => setUi("learn", null)}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <div class="frame-body" id="frame-panel" role="tabpanel" aria-labelledby={`ftab-${ui.learn}`}>
        <Switch>
          <Match when={ui.learn === "tutorial"}>
            <Written name="texts/tutorial" />
            <button type="button" class="btn" onClick={() => props.tour()}>
              <Compass aria-hidden="true" />
              Take the tour of the page
            </button>
            <ol class="lessons">
              <For each={LESSONS.map((name, i) => [name, i + 1] as const)}>
                {([name, lesson]) => (
                  <li>
                    <Show
                      when={props.examples.some((e) => e.lesson === lesson)}
                      fallback={
                        <>
                          <span>{name}</span>
                          <span class="sub">to come</span>
                        </>
                      }
                    >
                      <details class="lesson" open={lesson === 1}>
                        <summary class="prac-h">
                          {lesson}. {name}
                        </summary>
                        <p class="sub">Practice: decide first whether each has a proof.</p>
                        <ul class="prac">
                          <For each={props.examples.filter((e) => e.lesson === lesson)}>
                            {(example) => (
                              <Exercise example={example} prover={props.prover} ui={props.ui} />
                            )}
                          </For>
                        </ul>
                      </details>
                    </Show>
                  </li>
                )}
              </For>
            </ol>
          </Match>
          <Match when={ui.learn === "reference"}>
            <Written name="texts/reference" spot={ui.spot} />
          </Match>
        </Switch>
        <Written name="licence" class="frame-licence" />
      </div>
    </aside>
  );
}

function Exercise(props: { example: Example; prover: Prover; ui: Ui }) {
  const busy = () => props.prover.busy();
  return (
    <li class="exercise">
      <div class="ex-head">
        <span class="ex-title">{props.example.title}</span>
        <span class="diff">
          <Stairs level={props.example.level} />
          {LEVEL_NAMES[props.example.level]}
        </span>
      </div>
      <p class="m ex-seq">{displayed(props.example.sequent)}</p>
      <p class="row">
        <button
          type="button"
          class="btn btn-s outline"
          disabled={busy()}
          aria-label={`Prove ${props.example.title}`}
          onClick={() => void props.prover.example(props.example, false)}
        >
          Prove
        </button>
      </p>
      <details class="answer">
        <summary aria-label={`The answer to ${props.example.title}`}>Answer</summary>
        <p class={`kw ${props.example.verdict === "provable" ? "ok" : "bad"}`}>
          {props.example.verdict === "provable" ? "Provable" : "No proof"}
        </p>
        <Written name={`problems/${props.example.id}`} class="sub" />
        <Show when={props.example.session}>
          <button
            type="button"
            class="btn btn-s outline"
            disabled={busy()}
            aria-label={`Watch ${props.example.title}`}
            data-tip="Its proof from the start: Redo plays the next step"
            onClick={async () => {
              await props.prover.example(props.example, true);
              props.ui.setUi("live", `${props.example.title}: press Redo to play the next step.`);
            }}
          >
            <Play aria-hidden="true" />
            Watch the proof
          </button>
        </Show>
      </details>
    </li>
  );
}
