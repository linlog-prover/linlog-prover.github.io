// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * Learn: a frame around the window, on only when the visitor turns it on,
 * holding three places. The tutorial (its opening and the lessons' places,
 * which perform real steps on the stage once written; the tour of the page
 * meanwhile), practice (the examples, each proved by the visitor or watched
 * step by step) and the reference (the connectives). The texts are the
 * page's written content, cloned from its templates, with their licence.
 */

import { Compass, Play, X } from "lucide-solid";
import { For, Match, Show, Switch } from "solid-js";
import { type Example, written } from "../lib/content";
import { pretty } from "../lib/words";
import type { Prover } from "./state";
import type { Rubric, Ui } from "./ui";

/** A written text of the page, by its template's name. */
export function Written(props: { name: string; class?: string }) {
  return (
    <div
      class={`written ${props.class ?? ""}`}
      ref={(el) => queueMicrotask(() => el.replaceChildren(written(props.name)))}
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
  ["practice", "Practice"],
  ["reference", "Reference"],
];

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
                onClick={() => setUi("learn", rubric)}
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
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div class="frame-body" id="frame-panel" role="tabpanel" aria-labelledby={`ftab-${ui.learn}`}>
        <Switch>
          <Match when={ui.learn === "tutorial"}>
            <Written name="texts/tutorial" />
            <button type="button" class="btn" onClick={() => props.tour()}>
              <Compass size={16} aria-hidden="true" />
              Take the tour of the page
            </button>
            <ol class="lessons">
              <For each={LESSONS}>
                {(lesson) => (
                  <li>
                    <span>{lesson}</span>
                    <span class="sub">to come</span>
                  </li>
                )}
              </For>
            </ol>
          </Match>
          <Match when={ui.learn === "practice"}>
            <Written name="texts/practice" />
            <ul class="prac">
              <For each={props.examples}>
                {(example) => <Exercise example={example} prover={props.prover} ui={props.ui} />}
              </For>
            </ul>
          </Match>
          <Match when={ui.learn === "reference"}>
            <Written name="texts/reference" />
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
        <span
          class="diff"
          role="img"
          aria-label={`Difficulty ${props.example.difficulty} of 3`}
          data-tip={`Difficulty ${props.example.difficulty} of 3`}
        >
          {"●".repeat(props.example.difficulty)}
          {"○".repeat(3 - props.example.difficulty)}
        </span>
      </div>
      <p class="m ex-seq">{pretty(props.example.sequent)}</p>
      <Written name={`examples/${props.example.id}`} class="sub" />
      <p class="row">
        <button
          type="button"
          class="btn btn-s"
          disabled={busy()}
          aria-label={`Prove ${props.example.title}`}
          onClick={() => void props.prover.example(props.example, false)}
        >
          Prove
        </button>
        <Show when={props.example.session}>
          <button
            type="button"
            class="btn btn-s"
            disabled={busy()}
            aria-label={`Watch ${props.example.title}`}
            data-tip="Its proof from the start: Redo plays the next step"
            onClick={async () => {
              await props.prover.example(props.example, true);
              props.ui.setUi("live", `${props.example.title}: press Redo to play the next step.`);
            }}
          >
            <Play size={14} aria-hidden="true" />
            Watch
          </button>
        </Show>
        <Show when={props.example.verdict === "unprovable"}>
          <span class="sub">No proof: find out why.</span>
        </Show>
      </p>
    </li>
  );
}
