import { ArrowUp, Square, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useKernel, useModule } from "@/core";
import { IconButton } from "@/ui";
import { cancel, moveUp, remove } from "../export.commands";
import { exportRef } from "../export.ref";
import { revealFile } from "../export.service";
import { formatSize, statusText } from "../logic/estimate";

const WORKING = ["preparing", "rendering", "finishing"];

/** One export. Progress is written straight to the DOM, so frames don't re-render it. */
export function QueueItem({ id }: { id: string }) {
  const { bus } = useKernel();
  const { queue } = useModule(exportRef);
  const bar = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLElement>(null);
  const job = queue.getState().jobs.find((one) => one.id === id);

  useEffect(() => {
    const show = () => {
      const current = queue.getState().jobs.find((one) => one.id === id);
      if (!current) return;
      if (bar.current) bar.current.style.width = `${current.progress * 100}%`;
      if (text.current) text.current.textContent = statusText(current);
    };
    show();
    return queue.subscribe(show);
  }, [id, queue]);

  if (!job) return null;
  const working = WORKING.includes(job.status);
  const input = { jobId: id };
  return (
    <div className="shrink-0 border-b border-border py-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-hand text-[13px] font-bold" title={job.path}>
            {job.file}
          </div>
          <small
            className="block truncate font-mono text-[11.5px] text-subtle-foreground"
            title={job.message}
          >
            {job.kindLabel} · ~{formatSize(job.estimatedBytes)} · <span ref={text} />
          </small>
        </div>
        {working && (
          <IconButton label="Cancel" onClick={() => void bus.run(cancel, input)}>
            <Square />
          </IconButton>
        )}
        {job.status === "waiting" && (
          <IconButton label="Move up" onClick={() => void bus.run(moveUp, input)}>
            <ArrowUp />
          </IconButton>
        )}
        {!working && (
          <IconButton label="Remove" onClick={() => void bus.run(remove, input)}>
            <X />
          </IconButton>
        )}
      </div>
      {(working || job.status === "done") && (
        <div className="mt-1.5 h-0.5 overflow-hidden bg-border">
          <div ref={bar} className="h-full bg-on" />
        </div>
      )}
      {job.status === "done" && (
        <button
          type="button"
          onClick={() => void revealFile(job.path)}
          className="mt-1.5 cursor-pointer text-xs text-primary hover:underline"
        >
          Show in folder
        </button>
      )}
    </div>
  );
}
