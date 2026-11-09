import { notify, type AppError, type Result } from "@/core";

/** Waits for a command and tells the user when it was refused. */
export async function settle<T>(
  running: Promise<Result<T, AppError>>,
): Promise<Result<T, AppError>> {
  const result = await running;
  if (!result.ok) notify("error", result.error.message);
  return result;
}
