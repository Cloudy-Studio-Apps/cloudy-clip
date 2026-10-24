/**
 * A structured, serializable error. Safe to show to users, send over MCP, or log.
 */
export interface AppError {
  /** Stable machine-readable code, e.g. `"invalid_input"` or `"timeline.overlap"`. */
  code: string;
  /** Human-readable explanation. Written so an agent can act on it. */
  message: string;
  /** Optional extra data (validation issues, offending ids, ...). Must be JSON-serializable. */
  details?: unknown;
}

/**
 * Outcome of an operation that can fail in an expected way.
 * Expected failures are returned, never thrown, so callers are forced to handle them.
 */
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };
