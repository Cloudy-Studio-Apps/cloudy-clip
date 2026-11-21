import { notify, type AppError, type Result } from "@/core";

/** Tells the user when a command failed (rule 32); the value when it ran, else undefined. */
export function report<T>(result: Result<T, AppError>): T | undefined {
  if (result.ok) return result.value;
  notify("error", result.error.message);
  return undefined;
}
