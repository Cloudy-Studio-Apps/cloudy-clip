import type { ScanFlight, ScanIo, ScanPart } from "./sound.tools.types";

/** The most results kept: a dialog's looks are few, and a file may change under them. */
const KEPT = 50;
/** Files measured at once by one run: each is an FFmpeg decoding. */
const AT_ONCE = 2;

const cancelled = () => new Error("Cancelled");

/**
 * Measures parts of files outside the bus (a long file outlasts its timeout), at most two at a
 * time per run, and keeps each result per kernel (never in the project) under its part's key until
 * `forget`. A part already being measured is joined, never measured twice. Each run stops by its
 * own signal; a part's FFmpeg stops only when no run waits for it any more. Strip silence and Match
 * level both measure this way.
 */
export function createScanner<P extends ScanPart, R>(io: ScanIo<P, R>) {
  const found = new Map<string, R>();
  const flights = new Map<string, ScanFlight<R>>();

  const keep = (key: string, result: R) => {
    found.set(key, result);
    if (found.size > KEPT) found.delete(found.keys().next().value!);
  };

  /** Starts measuring `part`. */
  function fly(part: P): ScanFlight<R> {
    const flight: ScanFlight<R> = {
      done: Promise.resolve(io.empty),
      jobId: null,
      waiters: 0,
      cancelled: false,
      progress: 0,
      listeners: new Set(),
    };
    flight.done = (async () => {
      try {
        const id = await io.begin(part, (p) => {
          flight.progress = p;
          for (const listen of flight.listeners) listen(p);
        });
        if (id === null) {
          keep(part.key, io.empty);
          return io.empty;
        }
        flight.jobId = id;
        if (flight.cancelled) void io.cancel(id).catch(() => undefined);
        const result = await io.finish(id);
        keep(part.key, result);
        return result;
      } finally {
        if (flights.get(part.key) === flight) flights.delete(part.key);
      }
    })();
    flights.set(part.key, flight);
    return flight;
  }

  /** Waits for `flight` until it ends or `signal` aborts; the last waiter to leave stops it. */
  function join(
    key: string,
    flight: ScanFlight<R>,
    report: (p: number) => void,
    signal?: AbortSignal,
  ) {
    flight.waiters += 1;
    flight.listeners.add(report);
    report(flight.progress);
    return new Promise<R>((resolve, reject) => {
      let left = false;
      const leave = () => {
        if (left) return false;
        left = true;
        flight.waiters -= 1;
        flight.listeners.delete(report);
        signal?.removeEventListener("abort", abort);
        return true;
      };
      const abort = () => {
        if (!leave()) return;
        if (flight.waiters === 0) {
          flight.cancelled = true;
          if (flights.get(key) === flight) flights.delete(key);
          if (flight.jobId !== null) void io.cancel(flight.jobId).catch(() => undefined);
        }
        reject(cancelled());
      };
      signal?.addEventListener("abort", abort, { once: true });
      flight.done.then(
        (result) => leave() && resolve(result),
        (error: unknown) => leave() && reject(error),
      );
    });
  }

  return {
    /** The result kept under `key`. */
    get: (key: string) => found.get(key),
    has: (key: string) => found.has(key),
    /**
     * Measures the parts not kept (joining those under way); `onProgress` gets 0 to 1 over them
     * all. Rejects with "Cancelled" when `signal` aborts, or with the native error.
     */
    async run(parts: readonly P[], onProgress?: (progress: number) => void, signal?: AbortSignal) {
      if (signal?.aborted) throw cancelled();
      const unique = [
        ...new Map(parts.filter((p) => !found.has(p.key)).map((p) => [p.key, p])).values(),
      ];
      const shares = new Map<string, number>();
      const report = (key: string) => (p: number) => {
        shares.set(key, p);
        const sum = [...shares.values()].reduce((a, b) => a + b, 0);
        onProgress?.(sum / unique.length);
      };
      const queue = [...unique];
      const worker = async () => {
        for (let part = queue.shift(); part; part = queue.shift()) {
          if (signal?.aborted) throw cancelled();
          if (!found.has(part.key)) {
            await join(part.key, flights.get(part.key) ?? fly(part), report(part.key), signal);
          }
          report(part.key)(1);
        }
      };
      try {
        await Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, worker));
      } catch (error) {
        // One failing stops the others still waiting.
        queue.length = 0;
        throw error;
      }
    },
    /** Stops every measurement under way (the kernel is going). */
    cancelAll() {
      for (const flight of flights.values()) {
        flight.cancelled = true;
        if (flight.jobId !== null) void io.cancel(flight.jobId).catch(() => undefined);
      }
      flights.clear();
    },
    forget: () => found.clear(),
  };
}
