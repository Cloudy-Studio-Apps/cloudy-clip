import { useState, type ReactNode } from "react";
import { formatTimecode, useKernel, useModule } from "@/core";
import { cn } from "@/ui";
import { agoLabel, ratioLabel } from "../logic/labels";
import { openProject } from "../workspace.commands";
import { workspaceRef } from "../workspace.ref";
import type { RecentProject } from "../workspace.types";

interface RecentRowProps {
  project: RecentProject;
  /** Its file is gone, so it can't be opened. */
  gone: boolean;
  /** Sits at the end of the row. */
  action?: ReactNode;
}

/** One project of the list: press to open. */
export function RecentRow({ project, gone, action }: RecentRowProps) {
  const { bus } = useKernel();
  const workspace = useModule(workspaceRef);
  const { width, height, duration, thumbnail } = project;
  const [now] = useState(Date.now);
  return (
    <div className="flex items-center gap-2 rounded-sm pr-1 hover:bg-hover">
      <button
        type="button"
        disabled={gone}
        title={[project.description, project.path].filter(Boolean).join("\n")}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2.5 p-1 text-left",
          gone ? "opacity-50" : "cursor-pointer",
        )}
        onClick={async () => {
          await workspace.prepareLeave();
          await bus.run(openProject, { path: project.path });
        }}
      >
        <span className="h-9 w-14 shrink-0 overflow-hidden rounded-xs bg-surface-sunken">
          {thumbnail && <img src={thumbnail} alt="" className="size-full object-contain" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{project.name}</span>
          <span className="block truncate text-2xs text-muted-foreground">
            {gone
              ? "File not found"
              : [
                  width > 0 ? ratioLabel(width, height) : null,
                  formatTimecode(duration),
                  project.description,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </span>
        </span>
        <span className="shrink-0 text-2xs text-subtle-foreground">
          {agoLabel(project.lastUsed, now)}
        </span>
      </button>
      {action}
    </div>
  );
}
