// linlog © Fabian Lukas Grubmüller 2026
// Licensed under the EUPL

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  answer,
  Cancelled,
  createClient,
  type Request,
  type WorkerLike,
  WorkerFailed,
} from "./protocol";

/** A worker in the test's hands: it holds requests until the test answers them. */
class Fake implements WorkerLike {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  received: Request[] = [];
  terminated = false;
  postMessage(message: unknown) {
    this.received.push(message as Request);
  }
  terminate() {
    this.terminated = true;
  }
  reply(request: Request, calls: Record<string, (...args: never[]) => unknown>) {
    this.onmessage?.({ data: answer(calls, request) } as MessageEvent);
  }
}

const calls = {
  echo: (x: unknown) => x,
  fail: () => {
    throw '{"code":"step","kind":"invalid","message":"refused"}';
  },
};

describe("the worker protocol", () => {
  it("matches answers to calls by id, in any order", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer(), { minLength: 1, maxLength: 20 }),
        fc.nat(),
        async (values, seed) => {
          const workers: Fake[] = [];
          const client = createClient(() => {
            const w = new Fake();
            workers.push(w);
            return w;
          });
          const promises = values.map((v) => client.call<number>("echo", v));
          const worker = workers[0] as Fake;
          // Answer in an order the seed shuffles.
          const order = [...worker.received].sort(
            (a, b) => ((a.id * 7919 + seed) % 97) - ((b.id * 7919 + seed) % 97),
          );
          for (const request of order) worker.reply(request, calls);
          expect(await Promise.all(promises)).toEqual(values);
          expect(client.pending()).toBe(0);
        },
      ),
    );
  });

  it("rejects with what the call threw", async () => {
    const worker = new Fake();
    const client = createClient(() => worker);
    const promise = client.call("fail");
    worker.reply(worker.received[0] as Request, calls);
    await expect(promise).rejects.toBe('{"code":"step","kind":"invalid","message":"refused"}');
  });

  it("cancels by terminating the worker and starting a fresh one", async () => {
    const workers: Fake[] = [];
    const counts: number[] = [];
    const client = createClient(
      () => {
        const w = new Fake();
        workers.push(w);
        return w;
      },
      (n) => counts.push(n),
    );
    const first = client.call("echo", 1);
    const second = client.call("echo", 2);
    client.cancel();
    await expect(first).rejects.toBeInstanceOf(Cancelled);
    await expect(second).rejects.toBeInstanceOf(Cancelled);
    expect(workers[0]?.terminated).toBe(true);
    expect(workers).toHaveLength(2);
    expect(counts.at(-1)).toBe(0);
    // The old worker's late answer is ignored; the fresh one serves the next call.
    workers[0]?.reply(workers[0].received[0] as Request, calls);
    const third = client.call("echo", 3);
    const fresh = workers[1] as Fake;
    fresh.reply(fresh.received[0] as Request, calls);
    await expect(third).resolves.toBe(3);
  });

  it("fails every pending call when the worker itself fails, and starts a fresh one", async () => {
    const workers: Fake[] = [];
    const client = createClient(() => {
      const w = new Fake();
      workers.push(w);
      return w;
    });
    const call = client.call("echo", 1);
    workers[0]?.onerror?.({ message: "out of memory", preventDefault() {} } as ErrorEvent);
    await expect(call).rejects.toBeInstanceOf(WorkerFailed);
    expect(workers).toHaveLength(2);
  });

  it("answers a call the worker does not have as an error", () => {
    const response = answer(calls, { id: 4, call: "toString", args: [] });
    expect(response).toMatchObject({ id: 4, ok: false });
  });
});
