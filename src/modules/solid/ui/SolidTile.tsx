import { X } from "lucide-react";
import { useState } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { gradientCss } from "@/modules/element";
import { startMediaDrag } from "@/modules/media";
import { projectRef } from "@/modules/project";
import { ContextMenu } from "@/ui";
import { removeSolid } from "../solid.commands";
import { SolidDialog } from "./SolidDialog";

const SECONDS = 1_000_000;

/**
 * A solid in the library. Dragged onto a timeline, it makes a clip of five seconds; a double click
 * or the right-click menu edits it.
 */
export function SolidTile({ id }: { id: string }) {
  const { bus } = useKernel();
  const solid = useStore(useModule(projectRef).store.api, (s) => s.solids[id]);
  const [editing, setEditing] = useState(false);
  if (!solid) return null;
  const { name, color, fillType, gradient, width, height } = solid;
  const remove = () => void bus.run(removeSolid, { solidId: id });
  const items = [
    { label: "Edit", onSelect: () => setEditing(true) },
    { label: "Remove", destructive: true, onSelect: remove },
  ];
  return (
    <>
      <ContextMenu items={items}>
        <div
          className="group relative cursor-grab"
          title={width === undefined ? "Match frame" : `${width} × ${height}`}
          onDoubleClick={() => setEditing(true)}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            const props = {
              color,
              ...(fillType && { fillType }),
              ...(gradient && { gradient }),
              ...(width !== undefined && { width, height }),
            };
            const item = { type: "element", kind: "solid", props, duration: 5 * SECONDS } as const;
            startMediaDrag(item, name, event.nativeEvent);
          }}
        >
          <div
            className="aspect-video w-full shadow-[0_0_0_1px_var(--border-strong)]"
            style={{
              background: fillType === "gradient" && gradient ? gradientCss(gradient) : color,
            }}
          />
          <p className="mt-1 truncate text-sm text-muted-foreground">{name}</p>
          <button
            type="button"
            aria-label={`Remove ${name}`}
            title="Remove from project"
            className="absolute right-1 top-1 hidden size-5 cursor-pointer place-items-center bg-black/60 text-white hover:bg-black/80 group-hover:grid"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={remove}
          >
            <X className="size-3" />
          </button>
        </div>
      </ContextMenu>
      {editing && <SolidDialog solid={solid} onClose={() => setEditing(false)} />}
    </>
  );
}
