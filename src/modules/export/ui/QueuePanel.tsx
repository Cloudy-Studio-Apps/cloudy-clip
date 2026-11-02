import { useMemo } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { Button } from "@/ui";
import { clearFinished, start } from "../export.commands";
import { exportRef } from "../export.ref";
import { ExportHeading } from "./ExportHeading";
import { QueueItem } from "./QueueItem";

const WORKING = ["preparing", "rendering", "finishing"];
const OVER = ["done", "failed", "cancelled"];

/** Who is in the queue, as text: stays equal while only progress moves. */
const listOf = ({ jobs }: { jobs: readonly { id: string; status: string }[] }) =>
  jobs.map(({ id, status }) => `${id}:${status}`).join(",");

/** The exports and what to do with them. */
export function QueuePanel() {
  const { bus } = useKernel();
  const { queue } = useModule(exportRef);
  const list = useStore(queue, listOf);
  const jobs = useMemo(
    () =>
      list
        ? list.split(",").map((entry) => {
            const [id = "", status = ""] = entry.split(":");
            return { id, status };
          })
        : [],
    [list],
  );
  const waiting = jobs.filter(({ status }) => status === "waiting").length;
  const busy = jobs.some(({ status }) => WORKING.includes(status));
  const over = jobs.some(({ status }) => OVER.includes(status));
  const label = busy ? "Exporting…" : waiting > 1 ? `Export all (${waiting})` : "Export";

  return (
    <aside className="flex min-h-0 flex-col gap-2.5 border-l border-border bg-surface p-3.5">
      <ExportHeading>{jobs.length > 0 ? `Queue (${jobs.length})` : "Queue"}</ExportHeading>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {jobs.length === 0 && (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            Nothing here yet. Choose your settings and press Add to queue.
          </p>
        )}
        {jobs.map(({ id }) => (
          <QueueItem key={id} id={id} />
        ))}
        {over && (
          <button
            type="button"
            onClick={() => void bus.run(clearFinished, {})}
            className="cursor-pointer self-start text-xs text-primary hover:underline"
          >
            Clear finished
          </button>
        )}
      </div>
      <Button
        variant="primary"
        className="shrink-0 justify-center"
        disabled={busy || waiting === 0}
        onClick={() => void bus.run(start, {})}
      >
        {label}
      </Button>
    </aside>
  );
}
