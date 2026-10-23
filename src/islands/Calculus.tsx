// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The calculus's switches, in the popover a tab's calculus mark opens, at
 * every width: a segmented control for classical or intuitionistic logic and
 * labelled switches for Mix, affine weakening and, in classical mode alone,
 * the two-sided presentation (greyed: linlog does not draw classical
 * derivations two-sided yet; intuitionistic ones are two-sided already, so
 * there it is not shown). A session is one sequent in one mode, so a change
 * restarts the proof, and the switches say so first when the proof has steps.
 */

import { Show } from "solid-js";
import type { Mode } from "../lib/linlog";
import type { Prover } from "./state";
import type { Ui } from "./ui";

/** The mode the switches make. */
export function modeOf(intuitionistic: boolean, mix: boolean, affine: boolean): Mode {
  if (intuitionistic) return affine ? "intuitionistic-affine" : "intuitionistic";
  if (affine) return mix ? "affine-mix" : "affine";
  return mix ? "mix" : "classical";
}

export function Calculus(props: { prover: Prover; ui: Ui }) {
  const proof = () => props.prover.current();
  const mode = () => proof()?.mode ?? "classical";
  const intuitionistic = () => mode().startsWith("intuitionistic");
  const mix = () => mode().endsWith("mix");
  const affine = () => mode().includes("affine");
  const { ui, setUi } = props.ui;

  function ask(next: Mode) {
    const p = proof();
    if (!p || next === p.mode) return;
    if ((p.view?.steps ?? 0) > 0) setUi("pendingMode", next);
    else void props.prover.setMode(p.id, next);
  }

  return (
    <fieldset class="calc" aria-label="Calculus">
      <fieldset class="seg" aria-label="Logic">
        <button
          type="button"
          class="seg-b"
          aria-pressed={!intuitionistic()}
          data-tip="One-sided classical linear logic"
          onClick={() => ask(modeOf(false, mix(), affine()))}
        >
          Classical
        </button>
        <button
          type="button"
          class="seg-b"
          aria-pressed={intuitionistic()}
          data-tip="Two-sided intuitionistic linear logic: one formula right of ⊢"
          onClick={() => ask(modeOf(true, false, affine()))}
        >
          Intuitionistic
        </button>
      </fieldset>
      <label
        class="sw"
        data-tip={intuitionistic() ? "Mix is a rule of classical linear logic" : "The Mix rule"}
      >
        <input
          type="checkbox"
          checked={mix()}
          disabled={intuitionistic()}
          onChange={(event) => ask(modeOf(false, event.currentTarget.checked, affine()))}
        />
        <span class="sw-t" aria-hidden="true" />
        Mix
      </label>
      <label class="sw" data-tip="Affine weakening: any formula may be dropped">
        <input
          type="checkbox"
          checked={affine()}
          onChange={(event) => ask(modeOf(intuitionistic(), mix(), event.currentTarget.checked))}
        />
        <span class="sw-t" aria-hidden="true" />
        Affine
      </label>
      <Show when={!intuitionistic()}>
        <label
          class="sw"
          data-tip="Drawing classical derivations two-sided is a later feature of linlog; they are drawn one-sided"
        >
          <input type="checkbox" disabled />
          <span class="sw-t" aria-hidden="true" />
          Two-sided
        </label>
      </Show>
      <Show when={ui.pendingMode}>
        {(next) => (
          <div class="cluster mode-warn" role="alertdialog" aria-label="Restart the proof">
            <p>Changing the calculus restarts this proof: its steps are lost.</p>
            <p class="row">
              <button
                type="button"
                class="btn btn-primary"
                onClick={() => {
                  // Read before the warning closes: its accessor goes stale with it.
                  const mode = next() as Mode;
                  const p = proof();
                  setUi("pendingMode", null);
                  if (p) void props.prover.setMode(p.id, mode);
                }}
              >
                Restart
              </button>
              <button type="button" class="btn" onClick={() => setUi("pendingMode", null)}>
                Keep the proof
              </button>
            </p>
          </div>
        )}
      </Show>
    </fieldset>
  );
}
