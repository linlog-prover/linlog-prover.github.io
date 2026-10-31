// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * Learn: a frame around the window, on only when the visitor turns it on,
 * holding two places. The tutorial: its opening, the tour of the page, and
 * the lessons. A written lesson is a worked proof played on the stage one
 * inference at a time, the rule predicted before each and its reason shown
 * beside it, the same proof with its last steps left to the visitor, its
 * practice (problems of the store, provable and not mixed), a
 * self-explanation prompt and a hinge question whose answer offers the next
 * lesson or the faded proof again; some lessons add a dead end, an attempt
 * that goes wrong, a search that gives up, problems asked of linlog, the
 * worked proof's cut eliminated, or an attempt whose last step linlog
 * refuses. A lesson not yet written has its practice alone. The reference: the connectives, the rules drawn as schemas, the
 * engines. The texts are the page's written content, cloned from its
 * templates, with their licence.
 */

import { ArrowLeft, Compass, Play, X } from "lucide-solid";
import { createEffect, createSignal, For, Match, onCleanup, Show, Switch } from "solid-js";
import { Portal } from "solid-js/web";
import { type Example, type Lesson, type Level, type Rule, written } from "../lib/content";
import type { SessionDoc } from "../lib/linlog";
import { LEVEL_NAMES } from "../lib/practice";
import { actions as actionsOf, goalAt } from "../lib/steps";
import { displayed } from "../lib/words";
import type { Prover } from "./state";
import { type Rubric, type Ui, Words } from "./ui";

/**
 * A written text of the page, by its template's name; `spot`, the id of an
 * element in it, is brought into view and marked.
 */
export function Written(props: {
  name: string;
  class?: string;
  spot?: string | null;
  /** Called with the text's element once its content is in. */
  ready?: (host: HTMLElement) => void;
}) {
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
        queueMicrotask(() => {
          el.replaceChildren(written(props.name));
          props.ready?.(el);
        });
      }}
    />
  );
}

/** The lessons in their order: the places of the tutorial. */
export const LESSONS = [
  "Reading a sequent",
  "The multiplicatives",
  "The additives",
  "The units",
  "The exponentials",
  "Two sides",
  "When there is no proof",
  "Proof nets",
  "Cut and its elimination",
  "The quantifiers",
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

/** A rule drawn as its schema: the premises over a bar over the conclusion, its name beside the bar. */
export function Schema(props: { rule: Rule }) {
  return (
    <span
      class="schema m"
      role="img"
      aria-label={`${props.rule.name}: from ${props.rule.premises.join(" and ") || "nothing"} to ${props.rule.conclusion}`}
    >
      <span class="sch-fig">
        <span class="sch-prem">
          <For each={props.rule.premises}>{(premise) => <span>{premise}</span>}</For>
        </span>
        <span class="sch-concl">{props.rule.conclusion}</span>
      </span>
      <span class="sch-name">{props.rule.name}</span>
    </span>
  );
}

/** The rules as the reference lists them: each schema, its names and what it does. */
function Rules(props: { rules: readonly Rule[] }) {
  return (
    <ul class="rule-list">
      <For each={props.rules}>
        {(rule) => (
          <li id={`rule-${rule.id.replace(/^\d+-/, "")}`}>
            <Schema rule={rule} />
            <p>
              <span class="rule-title">{rule.title}</span> <Words text={rule.says} />
            </p>
            <p class="sub">
              <Show
                when={rule.oneSided}
                fallback={
                  <>
                    Two-sided: <span class="m">{rule.twoSided?.join(", ")}</span>.
                  </>
                }
              >
                {(one) => (
                  <>
                    One-sided: <span class="m">{one()}</span>.
                  </>
                )}
              </Show>{" "}
              Lesson {rule.lesson}.
            </p>
          </li>
        )}
      </For>
    </ul>
  );
}

export function LearnFrame(props: {
  prover: Prover;
  ui: Ui;
  examples: readonly Example[];
  lessons: readonly Lesson[];
  rules: readonly Rule[];
  tour: () => void;
}) {
  const { ui, setUi } = props.ui;
  const [rulesAt, setRulesAt] = createSignal<HTMLElement>();
  const [twoSidedAt, setTwoSidedAt] = createSignal<HTMLElement>();
  const open = (lesson: number | null) => setUi({ lesson, reason: null });
  const opened = () => props.lessons.find((l) => l.lesson === ui.lesson);
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
          <Match when={ui.learn === "tutorial" && opened()}>
            {(lesson) => (
              <Show when={lesson()} keyed>
                {(l) => (
                  <LessonView
                    lesson={l}
                    next={props.lessons.find((n) => n.lesson === l.lesson + 1) ?? null}
                    examples={props.examples}
                    prover={props.prover}
                    ui={props.ui}
                    open={open}
                  />
                )}
              </Show>
            )}
          </Match>
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
                    <Switch
                      fallback={
                        <>
                          <span>{name}</span>
                          <span class="sub">to come</span>
                        </>
                      }
                    >
                      <Match when={props.lessons.some((l) => l.lesson === lesson)}>
                        <button
                          type="button"
                          class="lesson-open"
                          aria-label={`Lesson ${lesson}: ${name}`}
                          onClick={() => open(lesson)}
                        >
                          <span class="lesson-n" aria-hidden="true">
                            {lesson}
                          </span>
                          <span class="lesson-name">{name}</span>
                          <span class="sub">A worked proof, your turn, practice, a check</span>
                        </button>
                      </Match>
                      <Match when={props.examples.some((e) => e.lesson === lesson)}>
                        <details class="lesson">
                          <summary class="prac-h">
                            {lesson}. {name}
                          </summary>
                          <Practice
                            lesson={lesson}
                            examples={props.examples}
                            prover={props.prover}
                            ui={props.ui}
                          />
                        </details>
                      </Match>
                    </Switch>
                  </li>
                )}
              </For>
            </ol>
          </Match>
          <Match when={ui.learn === "reference"}>
            <Written
              name="texts/reference"
              spot={ui.spot}
              ready={(host) => {
                setRulesAt(host.querySelector<HTMLElement>("[data-rules]") ?? undefined);
                setTwoSidedAt(host.querySelector<HTMLElement>("[data-rules-two]") ?? undefined);
              }}
            />
            <Show when={rulesAt()}>
              {(at) => (
                <Portal mount={at()}>
                  <Rules rules={props.rules.filter((r) => r.twoSided)} />
                </Portal>
              )}
            </Show>
            <Show when={twoSidedAt()}>
              {(at) => (
                <Portal mount={at()}>
                  <Rules rules={props.rules.filter((r) => r.oneSided)} />
                </Portal>
              )}
            </Show>
          </Match>
        </Switch>
        <Written name="licence" class="frame-licence" />
      </div>
    </aside>
  );
}

/** A lesson's practice: its problems of the store, easiest first. */
function Practice(props: {
  lesson: number;
  examples: readonly Example[];
  prover: Prover;
  ui: Ui;
  counts?: Lesson["counts"];
}) {
  return (
    <>
      <p class="sub">Practice: decide first whether each has a proof.</p>
      <ul class="prac">
        <For each={props.examples.filter((e) => e.lesson === props.lesson)}>
          {(example) => (
            <Exercise
              example={example}
              prover={props.prover}
              ui={props.ui}
              count={props.counts?.find((c) => c.problem === example.id)}
            />
          )}
        </For>
      </ul>
    </>
  );
}

/**
 * A written lesson: its opening, the worked proof played on the stage (each rule predicted, then
 * played, its reason beside the inference), the self-explanation prompt after its densest step,
 * the faded proof, the practice and the hinge question.
 */
function LessonView(props: {
  lesson: Lesson;
  next: Lesson | null;
  examples: readonly Example[];
  prover: Prover;
  ui: Ui;
  open: (lesson: number | null) => void;
}) {
  const { setUi } = props.ui;
  const worked = props.examples.find((e) => e.id === props.lesson.worked);
  const all = worked?.session ? actionsOf(JSON.parse(worked.session) as SessionDoc) : [];
  const steps = props.lesson.steps;
  /** The tab the lesson's proof is on, while it is open. */
  const [tab, setTab] = createSignal<string | null>(null);
  /** What the tab shows: the worked proof, played up to `played`, or the faded one. */
  const [part, setPart] = createSignal<"worked" | "faded" | null>(null);
  const [played, setPlayed] = createSignal(0);
  /** What was said of the last step played: the rule and the guess before it. */
  const [said, setSaid] = createSignal<{ rule: string; guess: string | null } | null>(null);
  const [detoured, setDetoured] = createSignal(false);
  /** linlog's quick verdict on the dead end, once it is played: whether it could still close. */
  const [deadEnd, setDeadEnd] = createSignal<boolean | null>(null);
  const [compared, setCompared] = createSignal(false);
  const [chosen, setChosen] = createSignal<number | null>(null);
  let faded!: HTMLElement;
  // The stage's elimination explains each step's case while this lesson is open.
  setUi("cases", props.lesson.eliminate?.cases ?? null);
  onCleanup(() => setUi("cases", null));

  const onTab = () => props.prover.current()?.id === tab();
  const finished = () => onTab() && props.prover.current()?.view?.complete === true;
  /** The worked proof's cut, when the lesson counts it: the faded proof asks for it. */
  const cut = () => props.lesson.counts.find((c) => c.problem === props.lesson.worked);
  /** The inferences of the proof on the lesson's tab. */
  const inferences = () =>
    props.prover.current()?.session?.inferences.filter((i) => i.rule !== undefined).length ?? 0;

  async function start(at: number, watch: boolean) {
    if (!worked) return;
    const id = await props.prover.worked(worked, at, watch, tab());
    if (!id) return;
    setTab(id);
    setUi({ reason: null, split: null, selected: null });
  }

  async function begin() {
    await start(0, true);
    setPart("worked");
    setPlayed(0);
    setSaid(null);
    setDetoured(false);
    setDeadEnd(null);
  }

  /** Plays the next step of the worked proof, after the visitor's guess (or none). */
  async function reveal(guess: string | null) {
    const at = played();
    const step = steps[at];
    // One action at a time: a press while one runs does nothing, as the prover's own do.
    if (!step || props.prover.busy()) return;
    const p = props.prover.current();
    // The visitor may have worked on the tab meanwhile: take it back to where the lesson is.
    if (!onTab() || p?.redo.length !== all.length - at) await start(at, true);
    setUi({ split: null, selected: null });
    const path = all[at]?.path ?? [];
    await props.prover.redo();
    const id = tab();
    if (id) setUi("reason", { tab: id, path, text: `${step.rule}: ${step.reason}` });
    setUi("live", `${step.rule}. ${step.reason.replaceAll("`", "")}`);
    setSaid({ rule: step.rule, guess });
    setPlayed(at + 1);
  }

  /**
   * Plays the lesson's legal split that leads nowhere on the stage, its dead premises drawn,
   * with linlog's verdict on it; the next prediction takes it back (the tab no longer holds
   * the lesson's steps, so `reveal` replays them).
   */
  async function detour() {
    const d = props.lesson.detour;
    const action = all[played()];
    const session = props.prover.current()?.session;
    if (!d || !action || action.kind !== "step" || !onTab() || !session || props.prover.busy())
      return;
    const goal = goalAt(session, action.path);
    if (goal === undefined) return;
    const step = { position: action.step.position, rule: action.step.rule, left: d.left };
    setUi({ selected: null, split: null, reason: null });
    setDeadEnd(await props.prover.splitPasses(goal, step));
    await props.prover.apply(goal, step);
    setDetoured(true);
  }

  /** The worked proof finished on the lesson's tab, its derivation shown, for its cut to be eliminated. */
  async function finish() {
    await start(all.length, true);
    setPart("worked");
    setPlayed(steps.length);
    setSaid(null);
    setUi("tab", "tree");
  }

  async function fade() {
    await start(props.lesson.faded, false);
    setPart("faded");
    faded.scrollIntoView({ block: "start" });
  }

  const step = () => steps[played()];
  const option = () => {
    const i = chosen();
    return i === null ? undefined : props.lesson.hinge.options[i];
  };

  return (
    <article class="lesson-view" aria-labelledby="lesson-title">
      <button type="button" class="btn btn-s" onClick={() => props.open(null)}>
        <ArrowLeft aria-hidden="true" />
        All lessons
      </button>
      <h2 id="lesson-title" class="lesson-title">
        <span class="lesson-n" aria-hidden="true">
          {props.lesson.lesson}
        </span>
        {props.lesson.title}
      </h2>
      <Written name={`lessons/${props.lesson.id}`} />

      <Show when={worked && props.lesson.attempt}>
        {(attempt) => (
          <Attempt
            attempt={attempt()}
            sequent={worked?.sequent ?? ""}
            mode={worked?.mode ?? "classical"}
            prover={props.prover}
            ui={props.ui}
            tab={tab}
            setTab={setTab}
          />
        )}
      </Show>

      <section class="part" aria-labelledby="part-worked">
        <h3 id="part-worked">A worked proof</h3>
        <p class="m ex-seq">{worked ? displayed(worked.sequent) : ""}</p>
        <Show
          when={part() === "worked" && onTab()}
          fallback={
            <button type="button" class="btn btn-primary" onClick={() => void begin()}>
              Start the worked proof
            </button>
          }
        >
          <Show when={said()}>
            {(s) => (
              <p class="said" role="status">
                <Show
                  when={s().guess === null}
                  fallback={
                    <Show
                      when={s().guess === s().rule}
                      fallback={
                        <>
                          The step is <span class="m">{s().rule}</span>, not{" "}
                          <Show when={s().guess !== "no rule"} fallback="“no rule”">
                            <span class="m">{s().guess}</span>
                          </Show>
                          ; its reason is beside it on the stage.
                        </>
                      }
                    >
                      <span class="kw ok">Right</span> The step is <span class="m">{s().rule}</span>
                      ; its reason is beside it on the stage.
                    </Show>
                  }
                >
                  The step is <span class="m">{s().rule}</span>; its reason is beside it on the
                  stage.
                </Show>
              </p>
            )}
          </Show>
          <Show when={played() > props.lesson.explain.after}>
            <Explain explain={props.lesson.explain} compared={compared()} compare={setCompared} />
          </Show>
          <Show
            when={step()}
            fallback={
              <p class="row">
                <span class="kw ok">Proved</span>
                <button type="button" class="btn btn-s" onClick={() => void begin()}>
                  Play it again
                </button>
                <Show when={props.lesson.net}>
                  <button
                    type="button"
                    class="btn btn-s outline"
                    onClick={() => props.ui.setUi("tab", "net")}
                  >
                    See its net
                  </button>
                </Show>
              </p>
            }
          >
            <Show when={props.lesson.detour?.before === played()}>
              <div class="detour">
                <p>
                  <Words text={props.lesson.detour?.text ?? ""} />
                </p>
                <Show
                  when={detoured()}
                  fallback={
                    <button type="button" class="btn btn-s outline" onClick={() => void detour()}>
                      Play this split
                    </button>
                  }
                >
                  <p class="row" role="status">
                    <span class={`kw ${deadEnd() === false ? "bad" : "plain"}`}>
                      {deadEnd() === false ? "Cannot close" : "Played"}
                    </span>
                    On the stage, neither premise can be closed.
                  </p>
                </Show>
              </div>
            </Show>
            <fieldset class="predict">
              <legend>
                Step {played() + 1} of {steps.length}: predict the next rule.
              </legend>
              <div class="row">
                <For each={props.lesson.choices}>
                  {(rule) => (
                    <button
                      type="button"
                      class="btn outline rule-guess m"
                      aria-label={`Predict ${rule}`}
                      onClick={() => void reveal(rule)}
                    >
                      {rule}
                    </button>
                  )}
                </For>
              </div>
              <button type="button" class="btn btn-s outline" onClick={() => void reveal(null)}>
                Show the step
              </button>
            </fieldset>
          </Show>
        </Show>
      </section>

      <Show when={props.lesson.eliminate}>
        {(eliminate) => (
          <Eliminate
            eliminate={eliminate()}
            count={props.lesson.counts.find((c) => c.problem === props.lesson.worked)}
            finished={finished()}
            prover={props.prover}
            ui={props.ui}
            finish={finish}
          />
        )}
      </Show>

      <Show when={props.lesson.refusal}>
        {(refusal) => (
          <Refusal
            refusal={refusal()}
            examples={props.examples}
            prover={props.prover}
            ui={props.ui}
          />
        )}
      </Show>

      <section class="part" aria-labelledby="part-faded" ref={faded}>
        <h3 id="part-faded">Your turn</h3>
        <Show
          when={part() === "faded" && onTab()}
          fallback={
            <>
              <p class="sub">
                <Show
                  when={cut()}
                  fallback={
                    props.lesson.faded === 0
                      ? "The same proof, from its sequent: every step is yours."
                      : `The same proof with its first ${props.lesson.faded === 1 ? "step" : `${props.lesson.faded} steps`} played: the rest is yours.`
                  }
                >
                  {(c) => (
                    <Words
                      text={`The same proof, from its sequent, with its cut on \`${c().formula}\` (the stage's Cut): every step is yours.`}
                    />
                  )}
                </Show>
              </p>
              <button type="button" class="btn outline" onClick={() => void fade()}>
                Finish the proof yourself
              </button>
            </>
          }
        >
          <Show
            when={finished()}
            fallback={
              <p class="sub">
                Choose a formula on the stage for its rules. Hint (H) helps, one rung at a time.
              </p>
            }
          >
            <p class="row" role="status">
              <span class="kw ok">Proved</span>
              <Show when={cut()} fallback=" Now the practice below.">
                {(c) => (
                  <Words
                    text={` Your proof has ${inferences()} inferences; with the cut on \`${c().formula}\`, ${c().with}; cut-free, ${c().without}. Now the practice below.`}
                  />
                )}
              </Show>
            </p>
          </Show>
        </Show>
      </section>

      <Show when={props.lesson.gallery}>
        {(gallery) => (
          <Gallery
            gallery={gallery()}
            examples={props.examples}
            prover={props.prover}
            ui={props.ui}
          />
        )}
      </Show>

      <Show when={props.lesson.unknown}>
        {(unknown) => <GivesUp unknown={unknown()} prover={props.prover} />}
      </Show>

      <section class="part" aria-labelledby="part-practice">
        <h3 id="part-practice">Practice</h3>
        <Practice
          lesson={props.lesson.lesson}
          examples={props.examples}
          prover={props.prover}
          ui={props.ui}
          counts={props.lesson.counts}
        />
      </section>

      <section class="part" aria-labelledby="part-check">
        <h3 id="part-check">Check</h3>
        <fieldset class="hinge">
          <legend>
            <Words text={props.lesson.hinge.question} />
          </legend>
          <For each={props.lesson.hinge.options}>
            {(o, i) => (
              <label class="hinge-option">
                <input
                  type="radio"
                  name={`hinge-${props.lesson.id}`}
                  checked={chosen() === i()}
                  onChange={() => setChosen(i())}
                />
                <span class="hinge-dot" aria-hidden="true" />
                <span>
                  <Words text={o.text} />
                </span>
              </label>
            )}
          </For>
        </fieldset>
        <Show when={option()}>
          {(o) => (
            <div class="hinge-said" role="status" data-right={o().misconception ? undefined : ""}>
              <Show
                when={o().misconception}
                fallback={
                  <>
                    <p>
                      <span class="kw ok">Right</span> <Words text={o().why} />
                    </p>
                    <Show
                      when={props.next}
                      fallback={
                        <button type="button" class="btn" onClick={() => props.open(null)}>
                          Back to the lessons
                        </button>
                      }
                    >
                      {(n) => (
                        <button
                          type="button"
                          class="btn btn-primary"
                          onClick={() => props.open(n().lesson)}
                        >
                          Next lesson: {n().title}
                        </button>
                      )}
                    </Show>
                  </>
                }
              >
                {(m) => (
                  <>
                    <p>
                      <span class="kw bad">Not quite</span> This answer comes from the idea that{" "}
                      <Words text={lower(m())} />
                    </p>
                    <p>
                      <Words text={o().why} />
                    </p>
                    <button type="button" class="btn" onClick={() => void fade()}>
                      Try the faded proof again
                    </button>
                  </>
                )}
              </Show>
            </div>
          )}
        </Show>
      </section>
    </article>
  );
}

/**
 * An attempt at the worked proof's sequent that goes wrong (an erroneous example): its steps
 * played on the stage one at a time, each with the attempt's own reason beside it, then "which
 * step went wrong?", answered as the hinge question is, and linlog asked about the goal the wrong
 * step left. It plays on the lesson's tab, which the worked proof then takes back.
 */
function Attempt(props: {
  attempt: NonNullable<Lesson["attempt"]>;
  sequent: string;
  mode: Example["mode"];
  prover: Prover;
  ui: Ui;
  tab: () => string | null;
  setTab: (id: string) => void;
}) {
  const example = { sequent: props.sequent, mode: props.mode, session: props.attempt.session };
  const all = actionsOf(JSON.parse(props.attempt.session) as SessionDoc);
  const steps = props.attempt.steps;
  const wrong = steps.findIndex((s) => !s.misconception);
  /** The steps played so far, or null before the attempt starts. */
  const [played, setPlayed] = createSignal<number | null>(null);
  const [chosen, setChosen] = createSignal<number | null>(null);
  const [asked, setAsked] = createSignal(false);
  const onTab = () => props.prover.current()?.id === props.tab();

  /** Shows the attempt after its first `n` steps, the rest on the redo stack. */
  async function at(n: number): Promise<boolean> {
    const id = await props.prover.worked(example, n, true, props.tab());
    if (!id) return false;
    props.setTab(id);
    props.ui.setUi({ reason: null, split: null, selected: null });
    return true;
  }

  async function begin() {
    if (!(await at(0))) return;
    setPlayed(0);
    setChosen(null);
    setAsked(false);
  }

  async function next() {
    const n = played();
    const step = n === null ? undefined : steps[n];
    if (n === null || !step || props.prover.busy()) return;
    // The visitor may have worked on the tab meanwhile: take it back to where the attempt is.
    if (!onTab() || props.prover.current()?.redo.length !== all.length - n) {
      if (!(await at(n))) return;
    }
    const path = all[n]?.path ?? [];
    await props.prover.redo();
    const id = props.tab();
    if (id) props.ui.setUi("reason", { tab: id, path, text: `${step.rule}: ${step.reason}` });
    props.ui.setUi("live", `${step.rule}. ${step.reason.replaceAll("`", "")}`);
    setPlayed(n + 1);
  }

  /** Takes the attempt back to just after its wrong step and lets the search try the goal it left. */
  async function ask() {
    if (props.prover.busy() || !(await at(wrong + 1))) return;
    const session = props.prover.current()?.session;
    const after = all[wrong + 1];
    const goal = session && after ? goalAt(session, after.path) : undefined;
    if (goal === undefined) return;
    await props.prover.close(goal);
    setAsked(true);
  }

  const option = () => {
    const i = chosen();
    return i === null ? undefined : steps[i];
  };

  return (
    <section class="part" aria-labelledby="part-attempt">
      <h3 id="part-attempt">An attempt that went wrong</h3>
      <p>
        <Words text={props.attempt.text} />
      </p>
      <Show
        when={played() !== null && onTab()}
        fallback={
          <button type="button" class="btn btn-primary" onClick={() => void begin()}>
            Play the attempt
          </button>
        }
      >
        <Show
          when={(played() ?? 0) < steps.length}
          fallback={
            <>
              <fieldset class="hinge">
                <legend>The attempt is stuck. Which step went wrong?</legend>
                <For each={steps}>
                  {(s, i) => (
                    <label class="hinge-option">
                      <input
                        type="radio"
                        name="attempt-step"
                        checked={chosen() === i()}
                        onChange={() => setChosen(i())}
                      />
                      <span class="hinge-dot" aria-hidden="true" />
                      <span>
                        Step {i() + 1}, <span class="m">{s.rule}</span>
                        {/* Its reason here too, so that the visitor need not find the step on the stage. */}
                        <br />
                        <span class="sub">
                          <Words text={s.reason} />
                        </span>
                      </span>
                    </label>
                  )}
                </For>
              </fieldset>
              <Show when={option()}>
                {(o) => (
                  <div
                    class="hinge-said"
                    role="status"
                    data-right={o().misconception ? undefined : ""}
                  >
                    <Show
                      when={o().misconception}
                      fallback={
                        <>
                          <p>
                            <span class="kw ok">Right</span> <Words text={o().why} />
                          </p>
                          <Show
                            when={asked()}
                            fallback={
                              <button type="button" class="btn" onClick={() => void ask()}>
                                Ask linlog about the goal step {wrong + 1} left
                              </button>
                            }
                          >
                            <p class="sub">
                              linlog's answer is beside that goal on the stage. The worked proof
                              below takes the right step.
                            </p>
                          </Show>
                        </>
                      }
                    >
                      {(m) => (
                        <>
                          <p>
                            <span class="kw bad">Not quite</span> This answer comes from the idea
                            that <Words text={lower(m())} />
                          </p>
                          <p>
                            <Words text={o().why} />
                          </p>
                        </>
                      )}
                    </Show>
                  </div>
                )}
              </Show>
            </>
          }
        >
          <p class="row">
            <span class="sub">
              Step {(played() ?? 0) + 1} of {steps.length} of the attempt
            </span>
            <button type="button" class="btn btn-s outline" onClick={() => void next()}>
              Next step of the attempt
            </button>
          </p>
        </Show>
      </Show>
    </section>
  );
}

/**
 * Problems of the lesson shown on the stage: each opened and asked of linlog, so that its verdict
 * and the reason stand beside it (`ask`), or its proof replayed and its net drawn (`net`).
 */
function Gallery(props: {
  gallery: NonNullable<Lesson["gallery"]>;
  examples: readonly Example[];
  prover: Prover;
  ui: Ui;
}) {
  /** The tab a net was drawn on, reused while it holds that problem. */
  const [tab, setTab] = createSignal<string | null>(null);
  const items = () =>
    props.gallery.items.flatMap((item) => {
      const example = props.examples.find((e) => e.id === item.problem);
      return example ? [{ example, text: item.text }] : [];
    });

  async function show(example: Example) {
    if (props.prover.busy()) return;
    if (props.gallery.act === "ask") {
      // The search on the sequent itself, whose refutation the page checks, as Close does.
      await props.prover.example(example, false);
      await props.prover.close(0);
      return;
    }
    if (!example.session) return;
    const steps = actionsOf(JSON.parse(example.session) as SessionDoc).length;
    const id = await props.prover.worked(example, steps, false, tab());
    if (!id) return;
    setTab(id);
    props.ui.setUi("tab", "net");
  }

  return (
    <section class="part" aria-labelledby="part-gallery">
      <h3 id="part-gallery">{props.gallery.title}</h3>
      <ul class="prac">
        <For each={items()}>
          {(item) => (
            <li class="exercise">
              <div class="ex-head">
                <span class="ex-title">{item.example.title}</span>
              </div>
              <p class="m ex-seq">{displayed(item.example.sequent)}</p>
              <p class="sub">
                <Words text={item.text} />
              </p>
              <p class="row">
                <button
                  type="button"
                  class="btn btn-s outline"
                  disabled={props.prover.busy()}
                  onClick={() => void show(item.example)}
                >
                  {props.gallery.act === "ask"
                    ? `Ask linlog about ${item.example.title}`
                    : `Draw the net of ${item.example.title}`}
                </button>
              </p>
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}

/** A sequent searched with a budget too small to decide it: the visitor watches it answer unknown. */
function GivesUp(props: { unknown: NonNullable<Lesson["unknown"]>; prover: Prover }) {
  async function run() {
    if (props.prover.busy()) return;
    const u = props.unknown;
    await props.prover.example({ sequent: u.sequent, mode: u.mode, session: null }, false);
    await props.prover.close(0, u.budget / props.prover.settings().budget);
  }
  return (
    <section class="part" aria-labelledby="part-gives-up">
      <h3 id="part-gives-up">When the search gives up</h3>
      <p class="m ex-seq">{displayed(props.unknown.sequent)}</p>
      <p>
        <Words text={props.unknown.text} />
      </p>
      <p class="row">
        <button
          type="button"
          class="btn btn-s outline"
          disabled={props.prover.busy()}
          onClick={() => void run()}
        >
          Search it with a budget of {props.unknown.budget} units
        </button>
      </p>
    </section>
  );
}

/**
 * The worked proof's cut eliminated on the stage: the lesson shows the finished proof, the
 * stage's own elimination takes the steps (each case's reason beside it there), and the lesson
 * says how far each view has come and, once the derivation is cut-free, what it costs.
 */
function Eliminate(props: {
  eliminate: NonNullable<Lesson["eliminate"]>;
  count: Lesson["counts"][number] | undefined;
  finished: boolean;
  prover: Prover;
  ui: Ui;
  finish: () => Promise<void>;
}) {
  const elim = (on: "tree" | "net") => (props.finished ? props.prover.current()?.elim[on] : null);
  const status = (on: "tree" | "net") => {
    const e = elim(on);
    if (!e) return "not started";
    const steps = e.taken.length === 1 ? "1 step" : `${e.taken.length} steps`;
    const left = e.reached.cuts.length;
    if (left === 0) return `cut-free after ${steps}`;
    return `${steps}, ${left === 1 ? "1 cut" : `${left} cuts`} left`;
  };
  const cutFree = () => elim("tree")?.reached.cuts.length === 0;
  return (
    <section class="part" aria-labelledby="part-eliminate">
      <h3 id="part-eliminate">Eliminate the cut</h3>
      <p>
        <Words text={props.eliminate.text} />
      </p>
      <Show
        when={props.finished}
        fallback={
          <button type="button" class="btn outline" onClick={() => void props.finish()}>
            Show the finished proof
          </button>
        }
      >
        <p class="sub" role="status">
          On the derivation: {status("tree")}. On the net: {status("net")}.
        </p>
        <Show when={cutFree() && props.count}>
          {(c) => (
            <p>
              <span class="kw ok">Cut-free</span>{" "}
              <Words
                text={`The derivation has ${c().without} inferences, against ${c().with} with the cut on \`${c().formula}\`: the lemma's proof is in it once for each use.`}
              />
            </p>
          )}
        </Show>
        <p class="row">
          <Show
            when={props.ui.ui.tab === "net"}
            fallback={
              <button
                type="button"
                class="btn btn-s outline"
                onClick={() => props.ui.setUi("tab", "net")}
              >
                Turn the stage to the net
              </button>
            }
          >
            <button
              type="button"
              class="btn btn-s outline"
              onClick={() => props.ui.setUi("tab", "tree")}
            >
              Back to the derivation
            </button>
          </Show>
        </p>
      </Show>
    </section>
  );
}

/**
 * An attempt at a sequent with no proof, played on the stage one step at a time from its
 * unfinished session, each step's reason beside it; then its last step, which linlog refuses at
 * the goal, why it does, and linlog's verdict on the sequent.
 */
function Refusal(props: {
  refusal: NonNullable<Lesson["refusal"]>;
  examples: readonly Example[];
  prover: Prover;
  ui: Ui;
}) {
  const problem = props.examples.find((e) => e.id === props.refusal.problem);
  const example = {
    sequent: problem?.sequent ?? "",
    mode: problem?.mode ?? "classical",
    session: props.refusal.session,
  };
  const all = actionsOf(JSON.parse(props.refusal.session) as SessionDoc);
  const steps = props.refusal.steps;
  const [tab, setTab] = createSignal<string | null>(null);
  /** The steps played so far, or null before the attempt starts. */
  const [played, setPlayed] = createSignal<number | null>(null);
  const [tried, setTried] = createSignal(false);
  const onTab = () => props.prover.current()?.id === tab();

  /** Shows the attempt after its first `n` steps, the rest on the redo stack. */
  async function at(n: number): Promise<boolean> {
    const id = await props.prover.worked(example, n, true, tab());
    if (!id) return false;
    setTab(id);
    props.ui.setUi({ reason: null, split: null, selected: null });
    return true;
  }

  async function begin() {
    if (!(await at(0))) return;
    setPlayed(0);
    setTried(false);
  }

  async function next() {
    const n = played();
    const step = n === null ? undefined : steps[n];
    if (n === null || !step || props.prover.busy()) return;
    // The visitor may have worked on the tab meanwhile: take it back to where the attempt is.
    if (!onTab() || props.prover.current()?.redo.length !== all.length - n) {
      if (!(await at(n))) return;
    }
    const path = all[n]?.path ?? [];
    await props.prover.redo();
    const id = tab();
    if (id) props.ui.setUi("reason", { tab: id, path, text: `${step.rule}: ${step.reason}` });
    props.ui.setUi("live", `${step.rule}. ${step.reason.replaceAll("`", "")}`);
    setPlayed(n + 1);
  }

  /** The refused step, on the goal the attempt left open: linlog's refusal is the goal's note. */
  async function tryIt() {
    if (props.prover.busy()) return;
    if (!onTab() || (props.prover.current()?.redo.length ?? 0) > 0) {
      if (!(await at(all.length))) return;
    }
    const goal = props.prover.current()?.view?.goals[0]?.goal;
    if (goal === undefined) return;
    const { rule, position } = props.refusal.refused;
    props.ui.setUi({ reason: null, selected: null });
    await props.prover.apply(goal, { position, rule });
    setTried(true);
  }

  async function ask() {
    if (!problem || props.prover.busy()) return;
    await props.prover.example(problem, false);
    await props.prover.close(0);
  }

  return (
    <section class="part" aria-labelledby="part-refusal">
      <h3 id="part-refusal">A step linlog refuses</h3>
      <p class="m ex-seq">{displayed(example.sequent)}</p>
      <p>
        <Words text={props.refusal.text} />
      </p>
      <Show
        when={played() !== null && onTab()}
        fallback={
          <button type="button" class="btn btn-primary" onClick={() => void begin()}>
            Play the attempt
          </button>
        }
      >
        <Show
          when={(played() ?? 0) < steps.length}
          fallback={
            <>
              <p>
                Its last step, <span class="m">{props.refusal.refused.rule}</span>:{" "}
                <Words text={props.refusal.refused.reason} />
              </p>
              <p class="sub">
                Will linlog accept it? Decide, and say why to yourself, before you try it.
              </p>
              <Show
                when={tried()}
                fallback={
                  <button type="button" class="btn btn-s outline" onClick={() => void tryIt()}>
                    Try the last step
                  </button>
                }
              >
                <div class="hinge-said" role="status">
                  <p>
                    <span class="kw bad">Refused</span> <Words text={props.refusal.why} />
                  </p>
                  <button
                    type="button"
                    class="btn btn-s outline"
                    disabled={props.prover.busy()}
                    onClick={() => void ask()}
                  >
                    Ask linlog about {problem?.title ?? "the sequent"}
                  </button>
                </div>
              </Show>
            </>
          }
        >
          <p class="row">
            <span class="sub">
              Step {(played() ?? 0) + 1} of {steps.length} of the attempt
            </span>
            <button type="button" class="btn btn-s outline" onClick={() => void next()}>
              Next step of the attempt
            </button>
          </p>
        </Show>
      </Show>
    </section>
  );
}

/** A sentence's first letter in lower case, to follow "the idea that". */
const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** The self-explanation prompt: the visitor writes an answer, kept nowhere, then compares it with the model one. */
function Explain(props: {
  explain: Lesson["explain"];
  compared: boolean;
  compare: (on: boolean) => void;
}) {
  return (
    <div class="explain">
      <label class="explain-q" for="explain-box">
        <span class="kw-label">Explain it to yourself</span>
        <span>
          <Words text={props.explain.prompt} />
        </span>
      </label>
      <textarea id="explain-box" rows={3} />
      <Show
        when={props.compared}
        fallback={
          <button type="button" class="btn btn-s outline" onClick={() => props.compare(true)}>
            Compare with a model answer
          </button>
        }
      >
        <p class="model">
          <Words text={props.explain.answer} />
        </p>
      </Show>
    </div>
  );
}

function Exercise(props: {
  example: Example;
  prover: Prover;
  ui: Ui;
  /** For a problem to prove with a cut: its cut formula and the inferences with it and without. */
  count?: Lesson["counts"][number] | undefined;
}) {
  const busy = () => props.prover.busy();
  /** The inferences of the visitor's finished proof of this problem, on the tab shown. */
  const proved = () => {
    const p = props.prover.current();
    const mine =
      p?.view?.complete && p.input === props.example.sequent && p.mode === props.example.mode;
    return mine ? (p.session?.inferences.filter((i) => i.rule !== undefined).length ?? null) : null;
  };
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
      <Show when={props.count}>
        {(c) => (
          <>
            <p class="sub">
              <Words text={`Prove it with a cut on \`${c().formula}\`.`} />
            </p>
            <Show when={proved()}>
              {(n) => (
                <p class="sub" role="status">
                  <span class="kw ok">Proved</span>{" "}
                  <Words
                    text={`Your proof has ${n()} inferences; with the cut on \`${c().formula}\`, ${c().with}; cut-free, ${c().without}.`}
                  />
                </p>
              )}
            </Show>
          </>
        )}
      </Show>
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
