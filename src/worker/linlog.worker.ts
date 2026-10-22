// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The module worker that runs linlog's WebAssembly module, so that no call
 * blocks the page. It answers the page's requests (src/lib/protocol.ts) with
 * the module's calls, plus the step tree's two that a replay is made of
 * (src/lib/steps.ts), run here so that one request rebuilds a session and
 * one terminate() stops it. The module keeps nothing between calls.
 */

import init, * as linlog from "linlog-web/linlog_web.js";
import wasm from "linlog-web/linlog_web_bg.wasm?url";
import type { Played, SessionDoc } from "../lib/linlog";
import { answer, type Request } from "../lib/protocol";
import { type Action, play, replay } from "../lib/steps";

const calls = {
  about: linlog.about,
  defaults: linlog.defaults,
  read: linlog.read,
  start: linlog.start,
  view: linlog.view,
  rules: linlog.rules,
  split_passes: linlog.split_passes,
  apply: linlog.apply,
  undo: linlog.undo,
  close: linlog.close,
  close_all: linlog.close_all,
  fill: linlog.fill,
  hint: linlog.hint,
  proof: linlog.proof,
  prove: linlog.prove,
  draw: linlog.draw,
  draw_net: linlog.draw_net,
  export_as: linlog.export_as,
  render: linlog.render,
  certificate: linlog.certificate,
  replay: (session: string, todo: string, settings: string) =>
    JSON.stringify(
      replay(linlog, JSON.parse(session) as SessionDoc, JSON.parse(todo) as Action[], settings),
    ),
  play: (start: string, todo: string, settings: string) =>
    JSON.stringify(
      play(linlog, JSON.parse(start) as Played, JSON.parse(todo) as Action[], settings),
    ),
};

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

const ready = init({ module_or_path: wasm });

scope.onmessage = async (event) => {
  try {
    await ready;
  } catch (thrown) {
    scope.postMessage({
      id: event.data.id,
      ok: false,
      error: `the module did not load: ${String(thrown)}`,
    });
    return;
  }
  const response = answer(calls, event.data);
  const transfer =
    response.ok && response.value instanceof Uint8Array
      ? [response.value.buffer as ArrayBuffer]
      : [];
  scope.postMessage(response, transfer);
};
