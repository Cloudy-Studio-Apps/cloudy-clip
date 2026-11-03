import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useKernel } from "@/core";
import { MARKER_COLORS, type Marker, type MarkerColor } from "@/modules/project";
import { cn, IconButton } from "@/ui";
import { removeMarker, updateMarker } from "../marker.commands";
import { MARKER_HEX } from "../logic/markers";

interface MarkerEditorProps {
  marker: Marker;
  /** Remembers a picked color for the next marker. */
  onColor(color: MarkerColor): void;
}

/** A marker's note and color. Enter or a click outside keeps the note; Escape drops it. */
export function MarkerEditor({ marker, onColor }: MarkerEditorProps) {
  const { bus } = useKernel();
  const [note, setNote] = useState(marker.note);

  return (
    <div className="flex w-56 flex-col gap-1.5">
      <input
        autoFocus
        value={note}
        placeholder="Note"
        aria-label="Marker note"
        className="h-7 rounded-xs border border-border bg-surface-sunken px-1.5 text-sm outline-none focus:border-ring"
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          // The popover closes on Escape; the note goes back first so nothing is saved.
          if (e.key === "Escape") setNote(marker.note);
        }}
        onBlur={() => {
          if (note !== marker.note) void bus.run(updateMarker, { markerId: marker.id, note });
        }}
      />
      <div className="flex items-center gap-1" role="group" aria-label="Marker color">
        {MARKER_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            aria-pressed={marker.color === color}
            title={color}
            style={{ backgroundColor: MARKER_HEX[color] }}
            className={cn(
              "size-4 rounded-xs",
              marker.color === color && "ring-2 ring-foreground ring-offset-1 ring-offset-popover",
            )}
            onClick={() => {
              onColor(color);
              if (color !== marker.color) {
                void bus.run(updateMarker, { markerId: marker.id, color });
              }
            }}
          />
        ))}
        <IconButton
          className="ml-auto"
          label="Delete marker"
          onClick={() => void bus.run(removeMarker, { markerIds: [marker.id] })}
        >
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>
    </div>
  );
}
