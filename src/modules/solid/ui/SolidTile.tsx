import { X } from "lucide-react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { startMediaDrag } from "@/modules/media";
import { projectRef } from "@/modules/project";
import { removeSolid } from "../solid.commands";

const SECONDS = 1_000_000;

/** A solid in the library. Dragged onto a timeline, it makes a clip of five seconds. */
export function SolidTile({ id }: { id: string }) {
  const { bus } = useKernel();
  const solid = useStore(useModule(projectRef).store.api, (s) => s.solids[id]);
  if (!solid) return null;
  const { name, color, width, height } = solid;
  return (
    <div
      className="group relative cursor-grab"
      title={`${width} × ${height}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const props = { color, width, height };
        const item = { type: "element", kind: "solid", props, duration: 5 * SECONDS } as const;
        startMediaDrag(item, name, event.nativeEvent);
      }}
    >
      <div
        className="aspect-video w-full shadow-[0_0_0_1px_var(--border-strong)]"
        style={{ backgroundColor: color }}
      />
      <p className="mt-1 truncate text-sm text-muted-foreground">{name}</p>
      <button
        type="button"
        aria-label={`Remove ${name}`}
        title="Remove from project"
        className="absolute right-1 top-1 hidden size-5 cursor-pointer place-items-center bg-black/60 text-white hover:bg-black/80 group-hover:grid"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => void bus.run(removeSolid, { solidId: id })}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
