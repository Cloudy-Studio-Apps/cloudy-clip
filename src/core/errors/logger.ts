import type { Logger } from "./logger.types";
/**
 * Creates a scoped logger. Every line is prefixed with `[scope]` so logs from different
 * modules (and later plugins) can be told apart.
 */
export function createLogger(scope: string): Logger {
  const prefix = `[${scope}]`;
  const emit =
    (fn: (...args: unknown[]) => void) =>
    (message: string, data?: unknown): void => {
      if (data === undefined) fn(prefix, message);
      else fn(prefix, message, data);
    };
  return {
    debug: emit(console.debug),
    info: emit(console.info),
    warn: emit(console.warn),
    error: emit(console.error),
  };
}
