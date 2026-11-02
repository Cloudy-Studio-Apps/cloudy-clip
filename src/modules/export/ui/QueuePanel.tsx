import { useMemo } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { Button } from "@/ui";
import { clearFinished, start } from "../export.commands";
import { exportRef } from "../export.ref";
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
    <aside className="flex min-h-0 flex-col border-l border-border-strong bg-surface">
      <h2 className="shrink-0 px-3 pb-2 pt-3 font-hand text-md font-bold">
        {jobs.length > 0 ? `Queue (${jobs.length})` : "Queue"}
      </h2>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-2">
        {jobs.length === 0 && (
          <p className="border border-dashed border-border-strong px-4 py-[22px] text-center text-base text-muted-foreground">
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
            className="mt-2 cursor-pointer self-start text-xs text-primary hover:underline"
          >
            Clear finished
          </button>
        )}
      </div>
      <div className="shrink-0 border-t border-border-strong px-3 py-2.5">
        <Button
          variant="mark"
          className="h-[34px] w-full text-[14.5px]"
          disabled={busy || waiting === 0}
          onClick={() => void bus.run(start, {})}
        >
          {label}
        </Button>
      </div>
    </aside>
  );
}
