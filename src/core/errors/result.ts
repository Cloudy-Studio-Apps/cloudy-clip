import type { AppError, Result } from "./result.types";

/** Builds a successful {@link Result}. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Builds a failed {@link Result}. */
export function err(code: string, message: string, details?: unknown): Result<never, AppError> {
  return {
    ok: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
}

/**
 * An expected failure thrown from inside a command. The command bus turns it into a failed
 * {@link Result} with the given code. Anything else thrown is treated as an internal error.
 */
export class CommandFailure extends Error {
  readonly code: string;
  readonly details: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "CommandFailure";
    this.code = code;
    this.details = details;
  }
}

/** Converts any thrown value into an {@link AppError}. */
export function toAppError(error: unknown): AppError {
  if (error instanceof CommandFailure) {
    return error.details === undefined
      ? { code: error.code, message: error.message }
      : { code: error.code, message: error.message, details: error.details };
  }
  if (error instanceof Error) return { code: "internal", message: error.message };
  return { code: "internal", message: String(error) };
}
