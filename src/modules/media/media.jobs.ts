/** Thrown out of a queued job that wasn't wanted any more by its turn. */
export class Superseded extends Error {
  constructor() {
    super("No longer wanted");
  }
}

/**
 * The jobs making one kind of derived file in this kernel, by key: asking again while one runs
 * joins it, and what's made is remembered, so a file is never made twice.
 */
export function createDerivedJobs<T>() {
  const running = new Map<string, Promise<T>>();
  const made = new Map<string, T>();
  const failed = new Set<string>();
  return {
    run(key: string, make: () => Promise<T>): Promise<T> {
      const job = running.get(key);
      if (job) return job;
      const started = make().then(
        (result) => {
          made.set(key, result);
          running.delete(key);
          return result;
        },
        (error: unknown) => {
          running.delete(key);
          throw error;
        },
      );
      running.set(key, started);
      return started;
    },
    /** What a finished job made; undefined while it runs or before. */
    madeBy: (key: string) => made.get(key),
    isMade: (key: string) => made.has(key),
    /** Whether it's neither running nor known to fail, so it may start. */
    canStart: (key: string) => !running.has(key) && !failed.has(key),
    fail: (key: string) => failed.add(key),
  };
}

/**
 * Runs jobs one after another. When its turn comes, a job whose key `wanted` no longer accepts is
 * dropped with `Superseded` instead of starting, so it never holds the native encoder that
 * proxies, masters and reversed copies share.
 */
export function createSerialQueue(wanted: (key: string) => boolean) {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(key: string, start: () => Promise<T>): Promise<T> => {
    const job = tail.then(() => {
      if (!wanted(key)) throw new Superseded();
      return start();
    });
    tail = job.catch(() => undefined);
    return job;
  };
}
