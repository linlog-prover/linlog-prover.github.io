// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * linlog's calls as the page makes them: through the module worker
 * (src/worker/linlog.worker.ts), each answer read from its JSON. A call
 * rejects with what the call threw (linlog's error JSON, which `failure`
 * reads), or with `Cancelled` when the page stopped it.
 */

import type {
  Closed,
  ClosedAll,
  Hint,
  Inverted,
  Mode,
  Offered,
  Outcome,
  Played,
  ReadResult,
  SequentDoc,
  SessionDoc,
  StepForm,
} from "./linlog";
import { type Client, createClient, type WorkerLike } from "./protocol";
import type { Action, Replayed } from "./steps";

/** What `about` answers. */
export interface About {
  readonly linlog: string;
  readonly level: number;
  readonly stack_bytes: number;
}

/** The page's handle on linlog. */
export type Api = ReturnType<typeof createApi>;

/** A handle on a fresh worker; `changed` hears the number of pending calls. */
export function createApi(changed: (pending: number) => void) {
  const client: Client = createClient(
    () =>
      new Worker(new URL("../worker/linlog.worker.ts", import.meta.url), {
        type: "module",
      }) as WorkerLike,
    changed,
  );
  const json = async <T>(call: string, ...args: unknown[]) =>
    JSON.parse(await client.call<string>(call, ...args)) as T;
  const doc = (session: SessionDoc) => JSON.stringify(session);
  return {
    cancel: () => client.cancel(),
    about: () => json<About>("about"),
    defaults: () => json<{ limits: { work: number } }>("defaults"),
    read: (input: string, settings: string) => json<ReadResult>("read", input, settings),
    start: (sequent: SequentDoc, mode: Mode, settings: string) =>
      json<Inverted>("start", JSON.stringify(sequent), mode, settings),
    view: (session: SessionDoc, settings: string) =>
      json<Played["view"]>("view", doc(session), settings),
    rules: (session: SessionDoc, goal: number, position: number, settings: string) =>
      json<Offered[]>("rules", doc(session), goal, position, settings),
    splitPasses: (session: SessionDoc, goal: number, step: StepForm, settings: string) =>
      client.call<boolean>("split_passes", doc(session), goal, JSON.stringify(step), settings),
    apply: (session: SessionDoc, goal: number, step: StepForm, settings: string) =>
      json<Inverted & { opened: number[] }>(
        "apply",
        doc(session),
        goal,
        JSON.stringify(step),
        settings,
      ),
    close: (session: SessionDoc, goal: number, settings: string) =>
      json<Closed>("close", doc(session), goal, settings),
    fill: (session: SessionDoc, goal: number, source: SessionDoc, settings: string) =>
      json<Played & { filled: number }>("fill", doc(session), goal, doc(source), settings),
    invertAll: (session: SessionDoc, settings: string) =>
      json<Inverted>("invert_all", doc(session), settings),
    closeAll: (session: SessionDoc, settings: string) =>
      json<ClosedAll>("close_all", doc(session), settings),
    hint: (session: SessionDoc, goal: number, settings: string) =>
      json<Hint>("hint", doc(session), goal, settings),
    proof: (session: SessionDoc, settings: string) =>
      json<unknown>("proof", doc(session), settings),
    prove: (sequent: SequentDoc, mode: Mode, settings: string) =>
      json<{ outcome: Outcome; refutation_checked: boolean | null }>(
        "prove",
        JSON.stringify(sequent),
        mode,
        settings,
      ),
    draw: (session: SessionDoc, settings: string) =>
      client.call<string>("draw", doc(session), settings),
    drawNet: (session: SessionDoc, settings: string) =>
      client.call<string>("draw_net", doc(session), settings),
    exportAs: (session: SessionDoc, format: string, settings: string) =>
      client.call<string>("export_as", doc(session), format, settings),
    render: (svg: string, format: "png" | "pdf", font: Uint8Array, settings: string) =>
      client.call<Uint8Array>("render", svg, format, font, settings),
    certificate: (outcome: Outcome, settings: string) =>
      client.call<string>("certificate", JSON.stringify(outcome), settings),
    replay: (session: SessionDoc, todo: readonly Action[], settings: string) =>
      json<Replayed>("replay", doc(session), JSON.stringify(todo), settings),
    play: (start: Played, todo: readonly Action[], settings: string) =>
      json<Replayed>("play", JSON.stringify(start), JSON.stringify(todo), settings),
  };
}
