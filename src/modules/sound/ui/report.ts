import { notify, type AppError, type Result } from "@/core";

/** Tells the user when a command failed, as a toast (rule 32): `bus.run(...).then(report)`. */
export function report(result: Result<unknown, AppError>): void {
  if (!result.ok) notify("error", result.error.message);
}
