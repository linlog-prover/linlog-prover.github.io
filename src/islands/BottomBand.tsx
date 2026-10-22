// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The bottom band: what I can do with the proof, each action by name with
 * its key. Undo and redo (icons alone, as is conventional, with their names
 * on hover and focus), close all, hint; Export (a menu of the formats and
 * the link), Import (a file, a paste, or a drop onto the stage), Settings;
 * Learn, the tour, Keys and About. The menus open above the band. On a
 * phone the row keeps undo, redo, close all, hint, export and Learn, and
 * More opens a sheet with the calculus's switches and the other actions.
 */

import {
  CheckCheck,
  Compass,
  Download,
  GraduationCap,
  Info,
  Keyboard,
  Lightbulb,
  ListOrdered,
  Menu as MenuIcon,
  Redo2,
  SlidersHorizontal,
  Undo2,
  Upload,
} from "lucide-solid";
import { createResource, createSignal, For, type JSX, Show } from "solid-js";
import { engineLabel, engineName, engineTip } from "../lib/engines";
import {
  failure,
  type Failure,
  MATH_FONTS,
  type MathFont,
  type Outcome,
  type SessionDoc,
} from "../lib/linlog";
import { writeLink } from "../lib/link";
import { actions, goalAt } from "../lib/steps";
import { notTaken, pretty } from "../lib/words";
import type { Theme } from "../lib/theme";
import { Calculus } from "./Calculus";
import { DEFAULT_BUDGET, type Prover, pathKey } from "./state";
import { Written } from "./Learn";
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
  ["L", "Learn on or off"],
  ["E I ,", "Export, Import, Settings"],
  ["?", "This list"],
];

export function BottomBand(props: {
  prover: Prover;
  ui: Ui;
  hint: () => void;
  font: (name: MathFont) => Promise<Uint8Array>;
  theme: () => Theme;
  setTheme: (t: Theme) => void;
  tour: () => void;
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
            icon={<Undo2 aria-hidden="true" />}
            tip="Undo on this branch"
            keyName="U"
            alone
            disabled={!proof()?.session || proof()?.view?.steps === 0 || props.prover.busy()}
            onClick={() => void props.prover.undo()}
            show={key}
          />
          <Action
            label="Redo"
            icon={<Redo2 aria-hidden="true" />}
            tip="Redo"
            keyName="⇧U"
            alone
            disabled={!proof()?.redo.length || props.prover.busy()}
            onClick={() => void props.prover.redo()}
            show={key}
          />
          <Action
            label="Steps"
            icon={<ListOrdered aria-hidden="true" />}
            tip="Every step; click one to go back to it"
            keyName="S"
            wide
            expanded={ui.menu === "steps"}
            disabled={!proof()?.session}
            onClick={() => toggle("steps")}
            show={key}
            labelled={labelled}
          />
          <Action
            label="Close all"
            icon={<CheckCheck aria-hidden="true" />}
            tip="The search closes every open goal"
            keyName="⇧C"
            disabled={!proof()?.view || proof()?.view?.complete || props.prover.busy()}
            onClick={() => void props.prover.closeAll()}
            show={key}
            labelled={labelled}
          />
          <Action
            label="Hint"
            icon={<Lightbulb aria-hidden="true" />}
            tip="The next rung of the hint ladder"
            keyName="H"
            disabled={!proof()?.view || proof()?.view?.complete || props.prover.busy()}
            onClick={props.hint}
            show={key}
            labelled={labelled}
          />
        </div>
        <div class="group">
          <Action
            label="Export"
            icon={<Upload aria-hidden="true" />}
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
            icon={<Download aria-hidden="true" />}
            tip="A session or a sequent from a file"
            keyName="I"
            wide
            expanded={ui.menu === "import"}
            onClick={() => toggle("import")}
            show={key}
            labelled={labelled}
          />
          <Action
            label="Settings"
            icon={<SlidersHorizontal aria-hidden="true" />}
            tip="Budget, theme, keys"
            keyName=","
            wide
            expanded={ui.menu === "settings"}
            onClick={() => toggle("settings")}
            show={key}
            labelled={labelled}
          />
        </div>
        <div class="group">
          <Action
            label="Learn"
            icon={<GraduationCap aria-hidden="true" />}
            tip="The tutorial, practice and the reference, around the stage"
            keyName="L"
            pressed={ui.learn !== null}
            onClick={() => setUi("learn", ui.learn ? null : "practice")}
            show={key}
            labelled={labelled}
          />
          <Action
            label="Tour"
            icon={<Compass aria-hidden="true" />}
            tip="A walk through the page, proving a sequent"
            keyName=""
            wide
            onClick={props.tour}
            show={key}
            labelled={labelled}
          />
          <Action
            label="Keys"
            icon={<Keyboard aria-hidden="true" />}
            tip="Every key"
            keyName="?"
            wide
            expanded={ui.menu === "keys"}
            onClick={() => toggle("keys")}
            show={key}
            labelled={labelled}
          />
          <Action
            label="About"
            icon={<Info aria-hidden="true" />}
            tip="What this page is, its licences"
            keyName=""
            wide
            expanded={ui.menu === "about"}
            onClick={() => toggle("about")}
            show={key}
            labelled={labelled}
          />
          <Action
            label="More"
            icon={<MenuIcon aria-hidden="true" />}
            tip="The calculus, steps, import, settings, the tour, keys and About"
            keyName=""
            phone
            expanded={ui.menu === "more"}
            onClick={() => toggle("more")}
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
      <Show when={ui.menu === "more"}>
        <MoreSheet prover={props.prover} ui={props.ui} tour={props.tour} />
      </Show>
      <Show when={ui.menu === "import"}>
        <ImportPanel prover={props.prover} ui={props.ui} />
      </Show>
      <Show when={ui.menu === "settings"}>
        <SettingsPanel prover={props.prover} theme={props.theme} setTheme={props.setTheme} />
      </Show>
      <Show when={ui.menu === "about"}>
        <AboutPane prover={props.prover} />
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
  /** Only on a wide screen: on a phone it is in More's sheet. */
  wide?: boolean;
  /** Only on a phone. */
  phone?: boolean;
  disabled?: boolean | undefined;
  expanded?: boolean;
  pressed?: boolean;
  onClick: () => void;
  show: (k: string) => JSX.Element;
  labelled?: (label: string) => JSX.Element;
}) {
  return (
    <button
      type="button"
      class={`btn act${props.wide ? " wide-only" : ""}${props.phone ? " phone-only" : ""}`}
      aria-label={props.alone ? props.label : undefined}
      aria-expanded={props.expanded}
      aria-pressed={props.pressed}
      data-tip={props.tip}
      data-key={props.keyName || undefined}
      disabled={props.disabled}
      onClick={() => props.onClick()}
    >
      {props.icon}
      {props.alone ? null : props.labelled?.(props.label)}
      {props.keyName ? props.show(props.keyName) : null}
    </button>
  );
}

function ExportMenu(props: {
  prover: Prover;
  ui: Ui;
  font: (name: MathFont) => Promise<Uint8Array>;
}) {
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
        svg: {
          ids: false,
          essential: proof()?.mode.startsWith("intuitionistic") ?? false,
          net: props.prover.settings().net,
          font: props.prover.settings().font,
        },
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
      await props.font(props.prover.settings().font),
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
    /** Where the item cannot apply at all: a refuted goal's certificate on a finished proof. */
    hidden?: () => boolean;
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
      hidden: complete,
      off: () => {
        const kind = outcome()?.refutation?.kind;
        if (!outcome()) return "Close a goal the search refutes first";
        if (kind === "saturated")
          return "A refutation by saturation has no Rocq certificate: linlog's own checker verified its set";
        if (!kind || kind === "exhausted") return "An exhausted search leaves no certificate";
        return null;
      },
    },
  ];

  async function copyLink() {
    const p = proof();
    if (!p?.session) return;
    const written = await writeLink(pretty(p.input), p.mode, JSON.stringify(p.session));
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
        <For each={items.filter((item) => !item.hidden?.())}>
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
        <li role="none">
          <fieldset class="font-choice">
            <legend class="kw-label h">Font of SVG, PNG and PDF</legend>
            <div class="mlist fonts">
              <For each={MATH_FONTS}>
                {(font) => (
                  <button
                    type="button"
                    role="menuitemradio"
                    class="mi"
                    aria-checked={props.prover.settings().font === font.key}
                    data-tip={font.look}
                    onClick={() => props.prover.setSettings({ font: font.key })}
                  >
                    <span class="fmt">{font.name}</span>
                  </button>
                )}
              </For>
            </div>
          </fieldset>
        </li>
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
            class="file-in"
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
        <label class="lbl col">
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
        <fieldset class="lbl col">
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
        <fieldset class="lbl col">
          <legend>Net drawing</legend>
          <fieldset class="seg" aria-label="Net drawing">
            <For each={["formulas", "compact"] as const}>
              {(net) => (
                <button
                  type="button"
                  class="seg-b"
                  aria-pressed={props.prover.settings().net === net}
                  data-tip={
                    net === "formulas"
                      ? "Every formula of the net written"
                      : "The literals and the conclusions alone, for a wide net"
                  }
                  onClick={() => props.prover.setSettings({ net })}
                >
                  {net === "formulas" ? "Formulas" : "Compact"}
                </button>
              )}
            </For>
          </fieldset>
        </fieldset>
        <EngineChoice prover={props.prover} />
        <label class="sw wide-only">
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

/**
 * The engine every search is forced to, or Automatic: the engines that take
 * the current proof's sequent, the others greyed with why they do not.
 */
function EngineChoice(props: { prover: Prover }) {
  const proof = () => props.prover.current();
  const engine = () => props.prover.settings().engine;
  const [listed] = createResource(
    () => proof()?.session ?? null,
    (session) => props.prover.engines(session),
  );
  const refusalOf = (key: string): Failure | null =>
    listed()?.engines.find((e) => e.engine === key)?.refused ?? null;
  return (
    <fieldset class="lbl col">
      <legend>Engine</legend>
      <div class="choices" role="radiogroup" aria-label="Engine">
        <label
          class="seg-b"
          data-tip="linlog chooses the engine by the sequent's fragment and mode"
        >
          <input
            type="radio"
            name="engine"
            checked={engine() === null}
            onChange={() => props.prover.setSettings({ engine: null })}
          />
          <span>Automatic</span>
          <span class="why">
            {listed()?.automatic ? `here the ${engineName(listed()?.automatic ?? "")}` : ""}
          </span>
        </label>
        <For each={listed()?.engines ?? []}>
          {(e) => (
            <label
              class="seg-b"
              data-tip={e.refused ? notTaken(e.refused).sentence : engineTip(e.engine)}
            >
              <input
                type="radio"
                name="engine"
                checked={engine() === e.engine}
                disabled={e.refused !== null}
                onChange={() => props.prover.setSettings({ engine: e.engine })}
              />
              <span>{engineLabel(e.engine)}</span>
              <span class="why">{e.refused ? notTaken(e.refused).keyword : ""}</span>
            </label>
          )}
        </For>
      </div>
      <Show when={!proof()?.session}>
        <p class="sub">Start a proof to see which engines take its sequent.</p>
      </Show>
      <Show when={engine() !== null && refusalOf(engine() ?? "")}>
        <p class="sub">
          The {engineName(engine() ?? "")} does not take this proof's sequent: its searches are
          refused at the goal.
        </p>
      </Show>
    </fieldset>
  );
}

/** More's sheet on a phone: the calculus's switches and the actions the band leaves out. */
function MoreSheet(props: { prover: Prover; ui: Ui; tour: () => void }) {
  const { setUi } = props.ui;
  const items: readonly (readonly [string, Menu | "tour", () => JSX.Element])[] = [
    ["Steps", "steps", () => <ListOrdered aria-hidden="true" />],
    ["Import", "import", () => <Download aria-hidden="true" />],
    ["Settings", "settings", () => <SlidersHorizontal aria-hidden="true" />],
    ["Tour", "tour", () => <Compass aria-hidden="true" />],
    ["Keys", "keys", () => <Keyboard aria-hidden="true" />],
    ["About", "about", () => <Info aria-hidden="true" />],
  ];
  return (
    <div class="cluster menu" role="dialog" aria-label="More">
      <Show when={props.prover.current()?.session}>
        <p class="kw-label h">Calculus</p>
        <Calculus prover={props.prover} ui={props.ui} inSheet />
        <div class="msep" />
      </Show>
      <ul class="mlist">
        <For each={items}>
          {([label, menu, icon]) => (
            <li>
              <button
                type="button"
                class="mi icon-row"
                disabled={menu === "steps" && !props.prover.current()?.session}
                onClick={() => (menu === "tour" ? props.tour() : setUi("menu", menu))}
              >
                {icon()}
                <span>{label}</span>
              </button>
            </li>
          )}
        </For>
      </ul>
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
                    : `The ${engineName(proof()?.engines[pathKey(action.path)] ?? "") || "search"} closed goal ${goalNumber(action.path)}`}
                </span>
              </button>
            </li>
          )}
        </For>
      </ol>
    </div>
  );
}

/** The licences of what the page sends, each served with it. */
const LICENCES: readonly (readonly [string, string, string])[] = [
  ["The page's code and linlog", "EUPL-1.2", "/licenses/LICENSE.txt"],
  ["The written content", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"],
  ["Euler Math, the formulas' font", "SIL OFL 1.1", "/fonts/Euler-Math-OFL.txt"],
  ["STIX Two Math, a font of the exports", "SIL OFL 1.1", "/fonts/STIXTwoMath-OFL.txt"],
  ["Garamond-Math, a font of the exports", "SIL OFL 1.1", "/fonts/Garamond-Math-OFL.txt"],
  ["Asana Math, a font of the exports", "SIL OFL 1.1", "/fonts/Asana-Math-OFL.txt"],
  ["Figtree, the text's font", "SIL OFL 1.1", "/fonts/Figtree-OFL.txt"],
  ["Space Mono, the field's font", "SIL OFL 1.1", "/fonts/SpaceMono-OFL.txt"],
  ["The JavaScript's packages, Lucide's icons among them", "notices", "/licenses/bundle.txt"],
  ["The Rust crates inside linlog's module", "notices", "/licenses/THIRD-PARTY-NOTICES.txt"],
];

function AboutPane(props: { prover: Prover }) {
  const [about] = createResource(() => props.prover.api.about());
  return (
    <div class="cluster menu about" role="dialog" aria-label="About">
      <p class="kw-label h">About</p>
      <Written name="texts/about" />
      <p class="sub">
        linlog {about()?.linlog ?? ""}, reading session documents up to level {about()?.level ?? ""}
        .
      </p>
      <p class="kw-label h">Licences</p>
      <ul class="licences">
        <For each={LICENCES}>
          {([what, licence, href]) => (
            <li>
              {what}: <a href={href}>{licence}</a>
            </li>
          )}
        </For>
      </ul>
      <p class="sub privacy">
        No tracking. GitHub, which serves this site, logs every visitor's IP address, as{" "}
        <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">
          GitHub's privacy statement
        </a>{" "}
        says.
      </p>
    </div>
  );
}
