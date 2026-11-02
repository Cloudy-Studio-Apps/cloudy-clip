import { Clapperboard } from "lucide-react";
import { useMemo } from "react";
import { useStore } from "zustand";
import { formatTimecode, useModule, usePoint } from "@/core";
import { projectRef } from "@/modules/project";
import { cn } from "@/ui";
import { startMediaDrag } from "../media.drag";
import { libraryKinds } from "../media.points";
import { mediaRef } from "../media.ref";
import type { LibraryRow } from "../media.types";
import { useUsedMedia } from "./library.rows.hook";
import { LibraryListRow } from "./LibraryListRow";
import { MediaTile } from "./MediaTile";

function CompositionRow({ row }: { row: LibraryRow }) {
  const duration = useStore(
    useModule(projectRef).store.api,
    (s) => s.compositions[row.id]?.duration ?? 0,
  );
  return (
    <div
      className="flex cursor-grab items-center gap-2 py-1.5"
      onPointerDown={(event) => {
        if (event.button === 0) {
          startMediaDrag({ type: "composition", id: row.id }, row.name, event.nativeEvent);
        }
      }}
    >
      <Clapperboard aria-hidden className="size-4 shrink-0 text-subtle-foreground" />
      <span className="min-w-0 flex-1 truncate">{row.name}</span>
      <span className="font-mono text-[11.5px] text-subtle-foreground">
        {formatTimecode(duration)}
      </span>
    </div>
  );
}

interface LibraryRowsProps {
  rows: readonly LibraryRow[];
  /** Tiles as narrow as the side panel's. */
  compact?: boolean;
}

/** The items of the open place, as tiles or a list. A click selects, a drag places on a timeline. */
export function LibraryRows({ rows, compact }: LibraryRowsProps) {
  const { view } = useModule(mediaRef);
  const layout = useStore(view, (s) => s.layout);
  const selection = useStore(view, (s) => s.selection);
  const media = useStore(useModule(projectRef).store.api, (s) => s.media);
  const kinds = usePoint(libraryKinds);
  const used = useUsedMedia();
  const tiles = useMemo(() => new Map(kinds.map(({ type, Tile }) => [type, Tile])), [kinds]);
  const list = layout === "list" && !compact;

  return (
    <div
      className={cn(
        list
          ? "flex flex-col"
          : compact
            ? "grid auto-rows-min grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-x-2 gap-y-2.5"
            : "grid auto-rows-min grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-x-3 gap-y-3.5",
      )}
    >
      {rows.map((row) => {
        const Tile = tiles.get(row.type);
        const asset = media[row.id];
        return (
          <div
            key={`${row.type}:${row.id}`}
            className={cn(
              "min-w-0",
              list && "border-b border-border",
              selection[0] === row.id && "outline-2 outline-offset-2 outline-primary",
              row.type === "composition" && !list && "col-span-full",
            )}
            onClick={() => view.setState({ selection: [row.id] })}
          >
            {row.type === "composition" ? (
              <CompositionRow row={row} />
            ) : Tile ? (
              <Tile id={row.id} />
            ) : list ? (
              <LibraryListRow id={row.id} used={used.has(row.id)} />
            ) : (
              asset && <MediaTile asset={asset} used={used.has(row.id)} />
            )}
          </div>
        );
      })}
    </div>
  );
}
