import type { AppError, Result } from "../errors/result.types";
import { notify } from "./notifications";

/**
 * Tells the user when a command failed, as a toast (rule 32): `bus.run(...).then(report)`.
 * Returns the command's value when it ran, else undefined.
 */
export function report<T>(result: Result<T, AppError>): T | undefined {
  if (result.ok) return result.value;
  notify("error", result.error.message);
  return undefined;
}
