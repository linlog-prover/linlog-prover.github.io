// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The top band, one row: what I am working on. The open proofs as tabs,
 * each its verdict as a dot (the details on a click), its sequent in Euler
 * Math (the sequent field when clicked, or for a new proof), its calculus
 * and fragment as a small mark, and its close; then the new proof's `+` and
 * the light and dark toggle. Under the band, the field's problem with its
 * place marked.
 */

import { Moon, Plus, Sun, X } from "lucide-solid";
import { createEffect, createSignal, For, on, onMount, Show } from "solid-js";
import { effective, parseTheme, THEME_KEY, type Theme, toggled } from "../lib/theme";
import { displayed } from "../lib/words";
import type { Proof, Prover } from "./state";
import type { Ui } from "./ui";

/** A proof's state as its dot shows it. */
export function tone(proof: Proof): "ok" | "bad" | "warn" | "open" | "none" {
  if (!proof.view) return "none";
  if (proof.view.complete) return "ok";
  if (proof.verdict?.tone === "bad") return "bad";
  if (proof.verdict?.tone === "warn") return "warn";
  return "open";
}

/** The calculus's short mark. */
export function mark(proof: Proof): string {
  const names: Record<string, string> = {
    classical: "LL",
    affine: "LL+aff",
    mix: "LL+mix",
    "affine-mix": "LL+aff+mix",
    intuitionistic: "ILL",
    "intuitionistic-affine": "ILL+aff",
  };
  return names[proof.mode] ?? proof.mode;
}

const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

/** Sets the visitor's choice of scheme on the page and in the browser. */
export function applyTheme(theme: Theme) {
  if (theme === "system") delete document.documentElement.dataset["theme"];
  else document.documentElement.dataset["theme"] = theme;
  try {
    if (theme === "system") storage()?.removeItem(THEME_KEY);
    else storage()?.setItem(THEME_KEY, theme);
  } catch {
    // The choice holds for this visit alone.
  }
}

export function TopBand(props: {
  prover: Prover;
  ui: Ui;
  theme: () => Theme;
  setTheme: (t: Theme) => void;
}) {
  const { setUi } = props.ui;
  const current = () => props.prover.current();
  const dark = () =>
    effective(props.theme(), window.matchMedia("(prefers-color-scheme: dark)").matches) === "dark";

  onMount(() => props.setTheme(parseTheme(document.documentElement.dataset["theme"] ?? null)));

  return (
    <header class="band top">
      <span class="wordmark">linlog</span>
      <nav class="proofs" aria-label="Open proofs">
        <For each={props.prover.store.proofs}>
          {(proof) => <ProofTab proof={proof} prover={props.prover} ui={props.ui} />}
        </For>
        <button
          type="button"
          class="pt-new"
          aria-label="New proof"
          data-tip="A new proof"
          data-key="N"
          onClick={() => {
            props.prover.add();
            queueMicrotask(() => document.querySelector<HTMLInputElement>(".field")?.focus());
          }}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </nav>
      <span class="grow" />
      <button
        type="button"
        class="btn icon"
        aria-label={dark() ? "Light theme" : "Dark theme"}
        data-tip={dark() ? "Light theme" : "Dark theme"}
        onClick={() => {
          const next = toggled(
            props.theme(),
            window.matchMedia("(prefers-color-scheme: dark)").matches,
          );
          applyTheme(next);
          props.setTheme(next);
        }}
      >
        <Show when={dark()} fallback={<Moon size={18} aria-hidden="true" />}>
          <Sun size={18} aria-hidden="true" />
        </Show>
      </button>
      <Show when={current()?.inputProblem}>
        {(problem) => (
          <div class="cluster field-msg" role="alert">
            <p class="caret m-in">
              <Show when={problem().span} fallback={current()?.input}>
                {(span) => (
                  <>
                    {current()?.input.slice(0, span().start)}
                    <mark class="at">
                      {current()?.input.slice(
                        span().start,
                        Math.max(span().end, span().start + 1),
                      ) || " "}
                    </mark>
                    {current()?.input.slice(Math.max(span().end, span().start + 1))}
                  </>
                )}
              </Show>
            </p>
            <span class="kw bad" data-tip={problem().sentence}>
              {problem().keyword}
            </span>
          </div>
        )}
      </Show>
      <Show when={props.ui.ui.menu === "status" && current()}>
        {(proof) => (
          <StatusDetails proof={proof()} prover={props.prover} close={() => setUi("menu", null)} />
        )}
      </Show>
    </header>
  );
}

function ProofTab(props: { proof: Proof; prover: Prover; ui: Ui }) {
  const isActive = () => props.prover.store.active === props.proof.id;
  const [draft, setDraft] = createSignal(props.proof.input);
  // The field follows a text set from elsewhere (a link's sequent).
  createEffect(on(() => props.proof.input, setDraft, { defer: true }));
  let field: HTMLInputElement | undefined;
  let typing: ReturnType<typeof setTimeout> | undefined;
  /** The fragment beside the mark: the session's, or while typing the text's. */
  const fragment = () =>
    props.proof.view?.fragment ??
    (props.proof.editing && props.proof.typed
      ? props.proof.typed[
          props.proof.mode.startsWith("intuitionistic") ? "intuitionistic" : "classical"
        ]
      : undefined);
  const { ui, setUi } = props.ui;

  const statusWords = () => {
    const p = props.proof;
    if (!p.view) return "Not started";
    if (p.view.complete) return "Proved, checked step by step";
    if (p.verdict) return p.verdict.keyword;
    return `${p.view.goals.length} open ${p.view.goals.length === 1 ? "goal" : "goals"}`;
  };

  return (
    <div class="ptab" aria-current={isActive() ? "true" : undefined} data-proof={props.proof.id}>
      <button
        type="button"
        class="dot-b"
        aria-label={`Status: ${statusWords()}`}
        data-tip={statusWords()}
        aria-expanded={isActive() && ui.menu === "status"}
        onClick={() => {
          props.prover.activate(props.proof.id);
          setUi("menu", ui.menu === "status" ? null : "status");
        }}
      >
        <span class="dot" data-tone={tone(props.proof)} />
      </button>
      <Show
        when={props.proof.editing && isActive()}
        fallback={
          <button
            type="button"
            class="pt-go"
            data-tip={isActive() ? "Edit the sequent" : "Show this proof"}
            onClick={() => {
              if (isActive()) {
                setDraft(props.proof.input);
                props.prover.edit(props.proof.id, true);
                queueMicrotask(() => field?.focus());
              } else props.prover.activate(props.proof.id);
            }}
          >
            <span class="m">{props.proof.input ? displayed(props.proof.input) : "New proof"}</span>
          </button>
        }
      >
        <input
          ref={(el) => {
            field = el;
            queueMicrotask(() => el.focus());
          }}
          class="field"
          aria-label="Sequent"
          aria-invalid={props.proof.inputProblem ? "true" : undefined}
          placeholder="A * B |- B * A"
          spellcheck={false}
          autocomplete="off"
          value={draft()}
          onInput={(event) => {
            const text = event.currentTarget.value;
            setDraft(text);
            props.prover.setInput(props.proof.id, text);
            clearTimeout(typing);
            typing = setTimeout(() => void props.prover.preview(props.proof.id, text), 250);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void props.prover.submit(props.proof.id);
            } else if (event.key === "Escape" && props.proof.session) {
              event.preventDefault();
              event.stopPropagation();
              props.prover.edit(props.proof.id, false);
            }
          }}
        />
      </Show>
      <button
        type="button"
        class="pt-mark"
        data-tip={`Calculus ${props.proof.mode}${props.proof.view ? `, fragment ${props.proof.view.fragment}` : ""}`}
        aria-label={`Calculus ${props.proof.mode}${props.proof.view ? `, fragment ${props.proof.view.fragment}` : ""}`}
        onClick={() => {
          props.prover.activate(props.proof.id);
          setUi("menu", ui.menu === "calculus" ? null : "calculus");
        }}
      >
        {mark(props.proof)}
        <Show when={fragment()}>{(f) => <span class="frag">{f()}</span>}</Show>
      </button>
      <button
        type="button"
        class="pt-x"
        aria-label="Close this proof"
        data-tip="Close this proof"
        onClick={() => props.prover.remove(props.proof.id)}
      >
        <X size={14} aria-hidden="true" />
      </button>
      <Show when={isActive() && ui.menu === "calculus"}>
        <div class="cluster pop calc-pop" role="dialog" aria-label="Logic">
          <fieldset class="seg" aria-label="Logic">
            <button type="button" class="seg-b" aria-pressed="true">
              Linear
            </button>
            <button
              type="button"
              class="seg-b"
              aria-pressed="false"
              aria-disabled="true"
              data-tip="Ordinary propositional logic, through linlog's translations, comes later"
            >
              Ordinary
            </button>
          </fieldset>
          <p class="sub">
            The calculus's switches are on the stage. Fragment:{" "}
            {props.proof.view?.fragment ?? "not started"}.
          </p>
        </div>
      </Show>
    </div>
  );
}

function StatusDetails(props: { proof: Proof; prover: Prover; close: () => void }) {
  const v = () => props.proof.view;
  return (
    <div class="cluster pop status-pop" role="dialog" aria-label="Status">
      <Show when={v()} fallback={<p>Not started: type a sequent and press Enter.</p>}>
        {(view) => (
          <>
            <p>
              <Show
                when={view().complete}
                fallback={
                  <Show
                    when={props.proof.verdict}
                    fallback={<span class="kw acc">{view().goals.length} open goals</span>}
                  >
                    {(verdict) => (
                      <span class={`kw ${verdict().tone}`} data-tip={verdict().sentence}>
                        {verdict().keyword}
                      </span>
                    )}
                  </Show>
                }
              >
                <span class="kw ok" data-tip="Every step was checked by linlog as it was applied">
                  Proved, checked
                </span>
              </Show>
            </p>
            <Show when={props.proof.verdict}>
              {(verdict) => <p class="sub">{verdict().sentence}</p>}
            </Show>
            <dl class="facts">
              <dt>Fragment</dt>
              <dd>{view().fragment}</dd>
              <dt>Calculus</dt>
              <dd>{props.proof.mode}</dd>
              <dt>Steps</dt>
              <dd>{view().steps}</dd>
              <Show when={props.proof.verdict?.outcome?.engine}>
                {(engine) => (
                  <>
                    <dt>Engine</dt>
                    <dd>{engine()}</dd>
                  </>
                )}
              </Show>
            </dl>
          </>
        )}
      </Show>
      <button type="button" class="btn btn-s" onClick={() => props.close()}>
        Close
      </button>
    </div>
  );
}
