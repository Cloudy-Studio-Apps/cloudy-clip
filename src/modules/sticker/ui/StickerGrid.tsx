import type { StickerHit } from "../sticker.types";
import { StickerTile } from "./StickerTile";
import { useGridWindow } from "./sticker.window.hook";

const COLUMNS = 4;
const GAP = 4;

/** Every sticker of a list in four columns. Only the rows in view are drawn. */
export function StickerGrid({ hits }: { hits: readonly StickerHit[] }) {
  const rows = Math.ceil(hits.length / COLUMNS);
  const { ref, first, last, rowHeight } = useGridWindow(rows, COLUMNS, GAP);
  const tile = rowHeight - GAP;
  const shown = hits.slice(first * COLUMNS, last * COLUMNS);
  return (
    <div ref={ref} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <div className="relative" style={{ height: rows * rowHeight - GAP }}>
        {shown.map((hit, i) => {
          const index = first * COLUMNS + i;
          return (
            <div
              key={`${hit.pack}:${hit.sticker.id}`}
              className="absolute"
              style={{
                width: tile,
                height: tile,
                left: (index % COLUMNS) * rowHeight,
                top: Math.floor(index / COLUMNS) * rowHeight,
              }}
            >
              <StickerTile hit={hit} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
