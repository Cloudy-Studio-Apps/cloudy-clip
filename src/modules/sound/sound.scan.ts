import type { Micros } from "@/core";

/** The most results kept: a dialog's looks are few, and a file may change under them. */
const KEPT = 50;
/** Files measured at once: each is an FFmpeg decoding. */
const AT_ONCE = 2;

/** One part of a file to measure, and the key its result is kept under (it names everything the result depends on). */
export interface ScanPart {
  key: string;
  path: string;
  from: Micros;
  to: Micros;
}

/** How a kind of measurement reaches FFmpeg: begin (null when the file has no sound), finish, cancel. */
export interface ScanIo<P extends ScanPart, R> {
  begin(part: P, onProgress: (progress: number) => void): Promise<string | null>;
  finish(jobId: string): Promise<R>;
  cancel(jobId: string): Promise<void>;
  /** What a file with no sound gives. */
  empty: R;
}

/**
 * Measures parts of files outside the bus (a long file outlasts its timeout), at most two at a
 * time, and keeps each result per kernel (never in the project) under its part's key until `forget`.
 * Strip silence and Match level both measure this way.
 */
export function createScanner<P extends ScanPart, R>(io: ScanIo<P, R>) {
  const found = new Map<string, R>();
  const running = new Set<string>();
  let epoch = 0;

  async function one(part: P, mine: number, onDone: (p: number) => void) {
    if (mine !== epoch) throw new Error("Cancelled");
    const id = await io.begin(part, onDone);
    if (id === null) {
      found.set(part.key, io.empty);
      return;
    }
    running.add(id);
    if (mine !== epoch) void io.cancel(id).catch(() => undefined);
    try {
      found.set(part.key, await io.finish(id));
      if (found.size > KEPT) found.delete(found.keys().next().value!);
    } finally {
      running.delete(id);
    }
  }

  return {
    /** The result kept under `key`. */
    get: (key: string) => found.get(key),
    has: (key: string) => found.has(key),
    /** Measures the parts not kept; `onProgress` gets 0 to 1 over them all. Rejects with "Cancelled" or the native error. */
    async run(parts: readonly P[], onProgress?: (progress: number) => void) {
      const mine = epoch;
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
          await one(part, mine, report(part.key));
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
    /** Stops every measurement under way or waiting. */
    cancel() {
      epoch += 1;
      for (const id of running) void io.cancel(id).catch(() => undefined);
    },
    forget: () => found.clear(),
  };
}
