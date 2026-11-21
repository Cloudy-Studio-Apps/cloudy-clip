import { Pencil, Spline, Trash2, Unlink } from "lucide-react";
import { useState } from "react";
import { useStore } from "zustand";
import { notify, useKernel, useModule, type AppError, type Result } from "@/core";
import { previewRef } from "@/modules/preview";
import { projectRef, type Clip } from "@/modules/project";
import { MenuList, Popover } from "@/ui";
import { removePaths } from "../path.commands";
import { detachPath } from "../path.follow.commands";
import { pathRef } from "../path.ref";

/**
 * Over a clip that follows a path: the path's name at its top right. A click opens Edit path
 * (shows it on the canvas), Stop following and Delete path, both at the playhead.
 */
export function PathBadge({ clip }: { clip: Clip; selected: boolean }) {
  const { bus } = useKernel();
  const { ui } = useModule(pathRef);
  const preview = useModule(previewRef);
  const pathId = clip.follow?.pathId;
  const path = useStore(useModule(projectRef).store.api, (s) =>
    pathId ? s.paths?.[pathId] : undefined,
  );
  const [open, setOpen] = useState(false);
  if (!path) return null;

  const tell = (result: Result<unknown, AppError>) => {
    if (!result.ok) notify("error", result.error.message);
  };
  const at = () => preview.playback.getTime();

  return (
    // Stops here, not on the button: the Popover toggles on the click, and the menu's own events
    // (portaled, but bubbling through React) must not start a clip drag either.
    <div
      className="pointer-events-auto absolute right-6 top-1 max-w-[calc(100%-2rem)]"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger={
          <button
            type="button"
            title={`Follows ${path.name}`}
            className="flex h-4 min-w-0 cursor-pointer items-center gap-0.5 rounded-xs bg-surface/80 px-1 text-2xs text-foreground hover:bg-on hover:text-background"
          >
            <Spline aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{path.name}</span>
          </button>
        }
      >
        <MenuList
          onClose={() => setOpen(false)}
          items={[
            {
              label: "Edit path",
              icon: Pencil,
              onSelect: () => ui.setState({ selectedPathId: path.id, selectedPoint: null }),
            },
            {
              label: "Stop following",
              icon: Unlink,
              onSelect: () => void bus.run(detachPath, { clipIds: [clip.id], at: at() }).then(tell),
            },
            {
              label: "Delete path",
              icon: Trash2,
              group: "delete",
              destructive: true,
              onSelect: () =>
                void bus.run(removePaths, { pathIds: [path.id], at: at() }).then(tell),
            },
          ]}
        />
      </Popover>
    </div>
  );
}
