import { useMemo } from "react";
import { useModule, usePoint } from "@/core";
import { elements, type AnyElement, type CreateEntry } from "@/modules/element";
import { projectRef, useOpenFormat } from "@/modules/project";
import { timelineRef } from "../timeline.ref";
import { startCreateDrag } from "./create.gesture";

/**
 * The create tiles of one side panel: every element's `create` entries for `panel`. A click adds
 * the clip at the playhead; a drag drops it on the timeline (on the lane under the pointer when the
 * element may sit there, else the time is kept and the track picked for it).
 */
export function CreateTiles({ panel }: { panel: string }) {
  const timeline = useModule(timelineRef);
  const project = useModule(projectRef).store;
  const format = useOpenFormat();
  const all = usePoint(elements);
  const tiles = useMemo(
    () =>
      all.flatMap((element) =>
        (element.create ?? [])
          .filter((entry) => entry.panel === panel)
          .map((entry) => ({ element, entry })),
      ),
    [all, panel],
  );

  const add = (element: AnyElement, entry: CreateEntry, at: { start?: number; trackId?: string }) =>
    timeline.drop({
      item: { type: "element", kind: element.kind, props: entry.props?.(format) ?? {} },
      ...at,
    });

  const dropAt = (element: AnyElement, entry: CreateEntry, clientX: number, clientY: number) => {
    const target = timeline.dropTarget(clientX, clientY);
    if (!target) return;
    const kind = project.getState().tracks[target.trackId]?.kind;
    const fits = kind !== undefined && element.tracks.includes(kind);
    add(element, entry, { start: target.time, ...(fits && { trackId: target.trackId }) });
  };

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {tiles.map(({ element, entry }) => (
        <button
          key={`${element.kind}:${entry.id}`}
          type="button"
          title="Click to add at the playhead, or drag onto the timeline"
          className="grid h-[62px] cursor-grab place-items-center px-2 text-center font-hand text-md font-bold text-foreground bg-muted shadow-[inset_0_0_0_1px_var(--border)] hover:shadow-[inset_0_0_0_1.5px_var(--primary)]"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            startCreateDrag(e.nativeEvent, entry.label, {
              onClick: () => add(element, entry, {}),
              onDrop: (x, y) => dropAt(element, entry, x, y),
            });
          }}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}
