/** How long an agent's tool waits for a native job: under the MCP bridge's 30 s cut. */
export const AGENT_WAIT_MS = 25_000;

/**
 * Waits for `work` at most `AGENT_WAIT_MS`; "late" when it still runs. The work goes on, so the
 * tool says it runs and a later call joins it (the analyzer by composition, the scanner by part).
 */
export async function waitBriefly<T>(work: Promise<T>): Promise<T | "late"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<"late">((resolve) => {
    timer = setTimeout(() => resolve("late"), AGENT_WAIT_MS);
  });
  try {
    return await Promise.race([work, late]);
  } finally {
    clearTimeout(timer);
  }
}
