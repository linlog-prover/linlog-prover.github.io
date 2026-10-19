// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The bottom band: what I can do with the proof, each action by name with
 * its key. Undo and redo (icons alone, as is conventional, with their names
 * on hover and focus), close all, hint; Export (a menu of the formats and
 * the link), Import (a file, a paste, or a drop onto the stage), Settings;
 * Keys. The menus open above the band.
 */

import {
  CheckCheck,
  Download,
  Keyboard,
  Lightbulb,
  ListOrdered,
  Redo2,
  SlidersHorizontal,
  Undo2,
  Upload,
} from "lucide-solid";
import { createSignal, For, type JSX, Show } from "solid-js";
import { failure, type Outcome, type SessionDoc } from "../lib/linlog";
import { writeLink } from "../lib/link";
import { actions, goalAt } from "../lib/steps";
import type { Theme } from "../lib/theme";
import { DEFAULT_BUDGET, type Prover } from "./state";
import { applyTheme } from "./TopBand";
import type { Menu, Ui } from "./ui";

/** Saves a file the page made. */
function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The keys, as the Keys pane lists them. */
export const KEYS: readonly (readonly [string, string])[] = [
  ["Tab", "Move between the formulas and the controls"],
  ["Enter", "Open a formula's rules; apply a split"],
  ["1 to 9", "Pick a rule in the popover"],
  ["Esc", "Close the popover, the split or a menu"],
  ["[ ]", "Previous and next open goal"],
  ["U", "Undo on this branch"],
  ["⇧U", "Redo"],
  ["S", "Every step, to go back to one"],
  ["C", "Close the active goal by the search"],
  ["⇧C", "Close every open goal"],
  ["H", "The next rung of the hint ladder"],
  ["V", "Tree or net"],
  ["+ − F", "Zoom in, zoom out, fit"],
  ["N", "A new proof"],
  ["E I ,", "Export, Import, Settings"],
  ["?", "This list"],
];

export function BottomBand(props: {
  prover: Prover;
  ui: Ui;
  hint: () => void;
  font: () => Promise<Uint8Array>;
  theme: () => Theme;
  setTheme: (t: Theme) => void;
}) {
  const { ui, setUi } = props.ui;
  const proof = () => props.prover.current();
  const toggle = (menu: Menu) => setUi("menu", ui.menu === menu ? null : menu);
  const labelled = (label: string) => <span class="lb">{label}</span>;
  const key = (k: string) => (
    <Show when={props.prover.settings().showKeys}>
      <kbd class="k">{k}</kbd>
    </Show>
  );

  return (
    <>
      <footer class="band bottom">
        <div class="group">
          <Action
            label="Undo"
            icon={<Undo2 size={18} aria-hidden="true" />}
            tip="Undo on this branch"
            keyName="U"
            alone
            disabled={!proof()?.session || proof()?.view?.steps === 0}
            onClick={() => void props.prover.undo()}
            show={key}
          />
          <Action
            label="Redo"
            icon={<Redo2 size={18} aria-hidden="true" />}
            tip="Redo"
            keyName="⇧U"
            alone
            disabled={!proof()?.redo.length}
            onClick={() => void props.prover.redo()}
            show={key}
          />
          <Action
            label="Steps"
            icon={<ListOrdered size={18} aria-hidden="true" />}
            tip="Every step; click one to go back to it"
            keyName="S"
            expanded={ui.menu === "steps"}
            disabled={!proof()?.session}
            onClick={() => toggle("steps")}
            show={key}
            labelled={labelled}
          />
          <Action
            label="Close all"
            icon={<CheckCheck size={18} aria-hidden="true" />}
            tip="The search closes every open goal"
            keyName="⇧C"
            disabled={!proof()?.view || proof()?.view?.complete || props.prover.pending() > 0}
            onClick={() => void props.prover.closeAll()}
            show={key}
            labelled={labelled}
          />
          <Action
            label="Hint"
            icon={<Lightbulb size={18} aria-hidden="true" />}
            tip="The next rung of the hint ladder"
            keyName="H"
            disabled={!proof()?.view || proof()?.view?.complete}
            onClick={props.hint}
            show={key}
            labelled={labelled}
          />
        </div>
        <div class="group">
          <Action
            label="Export"
            icon={<Upload size={18} aria-hidden="true" />}
            tip="Every format, and the link"
            keyName="E"
            expanded={ui.menu === "export"}
            disabled={!proof()?.session}
            onClick={() => toggle("export")}
            show={key}
            labelled={labelled}
          />
          <Action
            label="Import"
            icon={<Download size={18} aria-hidden="true" />}
            tip="A session or a sequent from a file"
            keyName="I"
            expanded={ui.menu === "import"}
            onClick={() => toggle("import")}
            show={key}
            labelled={labelled}
          />
          <Action
            label="Settings"
            icon={<SlidersHorizontal size={18} aria-hidden="true" />}
            tip="Budget, theme, keys"
            keyName=","
            expanded={ui.menu === "settings"}
            onClick={() => toggle("settings")}
            show={key}
            labelled={labelled}
          />
        </div>
        <div class="group">
          <Action
            label="Keys"
            icon={<Keyboard size={18} aria-hidden="true" />}
            tip="Every key"
            keyName="?"
            expanded={ui.menu === "keys"}
            onClick={() => toggle("keys")}
            show={key}
            labelled={labelled}
          />
        </div>
      </footer>
      <Show when={ui.menu === "export"}>
        <ExportMenu prover={props.prover} ui={props.ui} font={props.font} />
      </Show>
      <Show when={ui.menu === "steps"}>
        <StepsPanel prover={props.prover} />
      </Show>
      <Show when={ui.menu === "import"}>
        <ImportPanel prover={props.prover} ui={props.ui} />
      </Show>
      <Show when={ui.menu === "settings"}>
        <SettingsPanel prover={props.prover} theme={props.theme} setTheme={props.setTheme} />
      </Show>
      <Show when={ui.menu === "keys"}>
        <div class="cluster menu" role="dialog" aria-label="Keys">
          <p class="kw-label h">Keys</p>
          <dl class="keys">
            <For each={KEYS}>
              {([k, what]) => (
                <>
                  <dt>
                    <kbd>{k}</kbd>
                  </dt>
                  <dd>{what}</dd>
                </>
              )}
            </For>
          </dl>
        </div>
      </Show>
    </>
  );
}

function Action(props: {
  label: string;
  icon: JSX.Element;
  tip: string;
  keyName: string;
  alone?: boolean;
  disabled?: boolean | undefined;
  expanded?: boolean;
  onClick: () => void;
  show: (k: string) => JSX.Element;
  labelled?: (label: string) => JSX.Element;
}) {
  return (
    <button
      type="button"
      class="btn act"
      aria-label={props.alone ? props.label : undefined}
      aria-expanded={props.expanded}
      data-tip={props.tip}
      data-key={props.keyName}
      disabled={props.disabled}
      onClick={() => props.onClick()}
    >
      {props.icon}
      {props.alone ? null : props.labelled?.(props.label)}
      {props.show(props.keyName)}
    </button>
  );
}

function ExportMenu(props: { prover: Prover; ui: Ui; font: () => Promise<Uint8Array> }) {
  const proof = () => props.prover.current();
  const [said, setSaid] = createSignal<string | null>(null);
  const net = () => props.ui.ui.tab === "net";
  const outcome = (): Outcome | undefined => {
    const p = proof();
    const o = p?.note?.outcome ?? p?.verdict?.outcome;
    return o?.verdict === "unprovable" ? o : undefined;
  };
  const exportSettings = () =>
    JSON.stringify({
      limits: { work: props.prover.settings().budget },
      styles: {
        svg: { ids: false, essential: proof()?.mode.startsWith("intuitionistic") ?? false },
      },
    });
  const name = () => "linlog-proof";

  async function run(what: () => Promise<void>) {
    setSaid(null);
    try {
      await what();
    } catch (thrown) {
      setSaid(failure(thrown instanceof Error ? thrown.message : thrown).message);
    }
  }

  const session = () => proof()?.session as SessionDoc;
  const drawing = () =>
    net()
      ? props.prover.api.drawNet(session(), exportSettings())
      : props.prover.api.exportAs(session(), "svg", exportSettings());

  async function rendered(format: "png" | "pdf") {
    const now = new Date();
    const settings = JSON.stringify({
      limits: { work: props.prover.settings().budget },
      styles: {
        pdf: {
          date: {
            year: now.getUTCFullYear(),
            month: now.getUTCMonth() + 1,
            day: now.getUTCDate(),
            hour: now.getUTCHours(),
            minute: now.getUTCMinutes(),
            second: now.getUTCSeconds(),
          },
        },
      },
    });
    const bytes = await props.prover.api.render(
      await drawing(),
      format,
      await props.font(),
      settings,
    );
    download(
      `${name()}.${format}`,
      bytes as BlobPart,
      format === "png" ? "image/png" : "application/pdf",
    );
  }

  const text = (format: string, extension: string, type: string) => async () => {
    download(
      `${name()}.${extension}`,
      await props.prover.api.exportAs(session(), format, exportSettings()),
      type,
    );
  };

  const complete = () => proof()?.view?.complete === true;

  const items: {
    label: string;
    detail: string;
    act: () => Promise<void>;
    off?: () => string | null;
  }[] = [
    {
      label: "SVG",
      detail: "The drawing, as a vector image",
      act: async () => download(`${name()}.svg`, await drawing(), "image/svg+xml"),
    },
    { label: "PNG", detail: "The drawing, as an image", act: () => rendered("png") },
    { label: "PDF", detail: "The drawing, as a PDF/A document", act: () => rendered("pdf") },
    {
      label: "LaTeX",
      detail: "The derivation for ebproof",
      act: text("latex", "tex", "text/x-tex"),
    },
    {
      label: "Typst",
      detail: "The derivation for curryst",
      act: text("typst", "typ", "text/plain"),
    },
    {
      label: "Text",
      detail: "The derivation as plain text",
      act: text("text", "txt", "text/plain"),
    },
    {
      label: "Session",
      detail: "The proof as linlog's session document (JSON), to import again",
      act: async () =>
        download(`${name()}.json`, JSON.stringify(session(), null, 2), "application/json"),
    },
    {
      label: "Rocq",
      detail: "The finished proof's certificate for Rocq",
      act: text("rocq", "v", "text/plain"),
      off: () => (complete() ? null : "The certificate is of a finished proof"),
    },
    {
      label: "Not derivable",
      detail: "The Rocq certificate that a refuted goal has no proof",
      act: async () =>
        download(
          `${name()}-refutation.v`,
          await props.prover.api.certificate(outcome() as Outcome, exportSettings()),
          "text/plain",
        ),
      off: () => (outcome() ? null : "Close a goal the search refutes first"),
    },
  ];

  async function copyLink() {
    const p = proof();
    if (!p?.session) return;
    const written = await writeLink(p.input, p.mode, JSON.stringify(p.session));
    const url = `${location.origin}${location.pathname}${written.hash}`;
    try {
      await navigator.clipboard.writeText(url);
      setSaid(
        written.whole
          ? "Link copied: it holds the proof as it stands."
          : "Link copied, with the sequent alone: the proof is too long for a link, so export the session file to keep it.",
      );
    } catch {
      setSaid(`Copy this link: ${url}`);
    }
  }

  return (
    <div class="cluster menu export" role="menu" aria-label="Export">
      <p class="kw-label h">Export {net() ? "the net" : "the derivation"}</p>
      <ul class="mlist">
        <For each={items}>
          {(item) => (
            <li>
              <button
                type="button"
                role="menuitem"
                class="mi"
                aria-disabled={item.off?.() ? "true" : undefined}
                data-tip={item.off?.() ?? item.detail}
                onClick={() => {
                  if (!item.off?.()) void run(item.act);
                }}
              >
                <span class="fmt">{item.label}</span>
                <span class="fn">{item.detail}</span>
              </button>
            </li>
          )}
        </For>
        <li class="msep" aria-hidden="true" />
        <li>
          <button type="button" role="menuitem" class="mi" onClick={() => void run(copyLink)}>
            <span class="fmt">Link</span>
            <span class="fn">Copy a link to this proof</span>
          </button>
        </li>
      </ul>
      <Show when={said()}>
        <p class="said" role="status">
          {said()}
        </p>
      </Show>
    </div>
  );
}

function ImportPanel(props: { prover: Prover; ui: Ui }) {
  const [text, setText] = createSignal("");
  const [said, setSaid] = createSignal<{ text: string; tone: string } | null>(null);

  async function take(content: string, from: string) {
    const outcome = await props.prover.open(content);
    if ("kind" in outcome) {
      setSaid({ text: `Imported a ${outcome.kind}${from}.`, tone: "ok" });
      props.ui.setUi("live", `Imported a ${outcome.kind}${from}.`);
    } else {
      setSaid({
        text: `${outcome.problem.keyword}: not imported. ${outcome.problem.sentence}`,
        tone: "bad",
      });
    }
  }

  return (
    <div class="cluster menu" role="dialog" aria-label="Import">
      <p class="kw-label h">Import</p>
      <div class="form">
        <label class="lbl">
          <span>File</span>
          <input
            type="file"
            accept=".json,application/json,text/plain"
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              if (file) await take(await file.text(), ` from ${file.name}`);
            }}
          />
        </label>
        <label class="lbl col">
          <span>Paste a session or a sequent's JSON, as linlog writes them</span>
          <textarea
            value={text()}
            onInput={(event) => setText(event.currentTarget.value)}
            spellcheck={false}
          />
        </label>
        <p class="row">
          <button
            type="button"
            class="btn btn-primary"
            disabled={!text().trim()}
            onClick={() => void take(text(), "")}
          >
            Import
          </button>
          <span class="sub">Or drop a .json file onto the stage.</span>
        </p>
        <Show when={said()}>
          {(s) => (
            <p class={`said kw ${s().tone}`} role="status">
              {s().text}
            </p>
          )}
        </Show>
      </div>
    </div>
  );
}

function SettingsPanel(props: {
  prover: Prover;
  theme: () => Theme;
  setTheme: (t: Theme) => void;
}) {
  return (
    <div class="cluster menu" role="dialog" aria-label="Settings">
      <p class="kw-label h">Settings</p>
      <div class="form">
        <label class="lbl">
          <span>Budget</span>
          <input
            class="num-in"
            type="number"
            min="1"
            step="1"
            value={props.prover.settings().budget}
            onChange={(event) => {
              const value = Math.floor(Number(event.currentTarget.value));
              props.prover.setSettings({ budget: value > 0 ? value : DEFAULT_BUDGET });
            }}
          />
        </label>
        <p class="sub">
          Units of work a search may do, about{" "}
          {Math.round(props.prover.settings().budget / 68e6) || "under one"} second
          {props.prover.settings().budget >= 1.36e8 ? "s" : ""} here.
        </p>
        <fieldset class="lbl">
          <legend>Theme</legend>
          <fieldset class="seg" aria-label="Theme">
            <For each={["system", "light", "dark"] as const}>
              {(t) => (
                <button
                  type="button"
                  class="seg-b"
                  aria-pressed={props.theme() === t}
                  onClick={() => {
                    applyTheme(t);
                    props.setTheme(t);
                  }}
                >
                  {t === "system" ? "System" : t === "light" ? "Light" : "Dark"}
                </button>
              )}
            </For>
          </fieldset>
        </fieldset>
        <label class="sw">
          <input
            type="checkbox"
            checked={props.prover.settings().showKeys}
            onChange={(event) =>
              props.prover.setSettings({ showKeys: event.currentTarget.checked })
            }
          />
          <span class="sw-t" aria-hidden="true" />
          Show keys beside actions
        </label>
      </div>
    </div>
  );
}

function StepsPanel(props: { prover: Prover }) {
  const proof = () => props.prover.current();
  const list = () => {
    const session = proof()?.session;
    return session ? actions(session) : [];
  };
  const goalNumber = (path: readonly number[]) => {
    const session = proof()?.session;
    return session ? (goalAt(session, path) ?? 0) + 1 : 0;
  };
  return (
    <div class="cluster menu" role="dialog" aria-label="Steps">
      <p class="kw-label h">Steps</p>
      <ol class="mlist">
        <li>
          <button type="button" class="mi" onClick={() => void props.prover.backTo(0)}>
            <span class="fmt">0</span>
            <span class="fn">The sequent, before any step</span>
          </button>
        </li>
        <For each={list()}>
          {(action, i) => (
            <li>
              <button type="button" class="mi" onClick={() => void props.prover.backTo(i() + 1)}>
                <span class="fmt">{i() + 1}</span>
                <span class="fn">
                  {action.kind === "step"
                    ? `${action.step.rule} on goal ${goalNumber(action.path)}`
                    : `The search closed goal ${goalNumber(action.path)}`}
                </span>
              </button>
            </li>
          )}
        </For>
      </ol>
    </div>
  );
}
