// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

/**
 * The page's side and the worker's side of the request-id protocol over
 * which the page calls linlog's module in a module worker.
 *
 * A request is `{id, call, args}`; the worker answers `{id, ok, value}` or
 * `{id, ok: false, error}`, the error being what the call threw (linlog's
 * error JSON as a string). Answers may come in any order and are matched by
 * id. The module reads no clock and its calls cannot be interrupted, so the
 * one way to stop a call is to terminate the worker: `cancel` does, rejects
 * every pending call with `Cancelled`, and starts a fresh worker for the
 * next one. Nothing is lost, since the module keeps nothing between calls:
 * the page holds every document it sends.
 */

/** A request from the page. */
export interface Request {
  readonly id: number;
  readonly call: string;
  readonly args: readonly unknown[];
}

/** The worker's answer to one request. */
export type Response =
  | { readonly id: number; readonly ok: true; readonly value: unknown }
  | { readonly id: number; readonly ok: false; readonly error: unknown };

/** What the page needs of a worker; the browser's `Worker` is one. */
export interface WorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

/** The rejection of a call the page stopped. */
export class Cancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "Cancelled";
  }
}

/** The rejection of every pending call when the worker itself failed (a crash, no memory). */
export class WorkerFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkerFailed";
  }
}

/** The page's handle on the worker. */
export interface Client {
  /** Calls `call` in the worker with `args`; rejects with what the call threw. */
  call<T>(call: string, ...args: unknown[]): Promise<T>;
  /** Stops every pending call: the worker is terminated and a fresh one started. */
  cancel(): void;
  /** How many calls are pending. */
  pending(): number;
}

interface Waiting {
  resolve(value: unknown): void;
  reject(reason: unknown): void;
}

/**
 * A client over workers from `spawn`. `changed` is told whenever the number
 * of pending calls changes, for the page's busy state.
 */
export function createClient(
  spawn: () => WorkerLike,
  changed: (pending: number) => void = () => {},
): Client {
  const waiting = new Map<number, Waiting>();
  let next = 1;
  let worker = start();

  function start(): WorkerLike {
    const fresh = spawn();
    fresh.onmessage = (event: MessageEvent) => {
      const response = event.data as Response;
      const entry = waiting.get(response.id);
      if (!entry) return;
      waiting.delete(response.id);
      changed(waiting.size);
      if (response.ok) entry.resolve(response.value);
      else entry.reject(response.error);
    };
    fresh.onerror = (event: ErrorEvent) => {
      event.preventDefault?.();
      failAll(new WorkerFailed(event.message || "the worker failed"));
      worker.terminate();
      worker = start();
    };
    return fresh;
  }

  function failAll(reason: unknown) {
    const entries = [...waiting.values()];
    waiting.clear();
    changed(0);
    for (const entry of entries) entry.reject(reason);
  }

  return {
    call<T>(call: string, ...args: unknown[]): Promise<T> {
      const id = next++;
      return new Promise<T>((resolve, reject) => {
        waiting.set(id, { resolve: resolve as (value: unknown) => void, reject });
        changed(waiting.size);
        worker.postMessage({ id, call, args } satisfies Request);
      });
    },
    cancel() {
      worker.terminate();
      failAll(new Cancelled());
      worker = start();
    },
    pending: () => waiting.size,
  };
}

/**
 * The worker's side: answers one request with the call it names. A call
 * that throws is answered with what it threw; a name the worker does not
 * have is answered as an error of the page's own.
 */
export function answer(
  calls: Readonly<Record<string, (...args: never[]) => unknown>>,
  request: Request,
): Response {
  const call = Object.hasOwn(calls, request.call) ? calls[request.call] : undefined;
  if (!call) {
    return {
      id: request.id,
      ok: false,
      error: JSON.stringify({ code: "page", kind: "internal", message: `no call ${request.call}` }),
    };
  }
  try {
    return { id: request.id, ok: true, value: call(...(request.args as never[])) };
  } catch (thrown) {
    return {
      id: request.id,
      ok: false,
      error: thrown instanceof Error ? `${thrown.name}: ${thrown.message}` : thrown,
    };
  }
}
