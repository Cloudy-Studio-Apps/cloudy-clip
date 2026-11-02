import { Folder } from "lucide-react";
import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule, usePoint } from "@/core";
import { projectRef, type Bin, type BinId } from "@/modules/project";
import { libraryKinds } from "../media.points";
import { mediaRef } from "../media.ref";
import type { LibraryPlace } from "../media.types";
import { SMART_BINS } from "./SmartBinList";

const MASTER = "bin:";
const valueOf = (place: LibraryPlace) =>
  place.kind === "bin" ? `bin:${place.binId ?? ""}` : `smart:${place.id}`;

function placeOf(value: string): LibraryPlace {
  if (value.startsWith("smart:")) return { kind: "smart", id: value.slice(6) };
  return { kind: "bin", binId: value.slice(4) || null };
}

/** Which bin the Media tab shows: the same one as the Media page. */
export function BinPicker() {
  const { view } = useModule(mediaRef);
  const place = useStore(view, (s) => s.place);
  const project = useModule(projectRef).store.api;
  const bins = useStore(project, (s) => s.bins);
  const binOrder = useStore(project, (s) => s.binOrder);
  const kinds = usePoint(libraryKinds);

  const tree = useMemo(() => {
    const lines: { bin: Bin; depth: number }[] = [];
    const add = (parentId: BinId | null, depth: number) => {
      for (const id of binOrder) {
        const bin = bins[id];
        if (bin?.parentId !== parentId) continue;
        lines.push({ bin, depth });
        add(id, depth + 1);
      }
    };
    add(null, 1);
    return lines;
  }, [bins, binOrder]);
  const smart = [...SMART_BINS, ...kinds.map(({ type, label }) => ({ id: type, label }))];

  return (
    <label className="flex h-7 shrink-0 items-center gap-1.5 rounded-[3px] border border-border-strong px-1.5 text-muted-foreground focus-within:border-ring">
      <Folder aria-hidden className="size-3.5 shrink-0" />
      <select
        aria-label="Bin"
        value={valueOf(place)}
        onChange={(event) => view.setState({ place: placeOf(event.target.value) })}
        className="h-full min-w-0 flex-1 cursor-pointer bg-transparent text-foreground outline-none [&_optgroup]:bg-popover [&_option]:bg-popover"
      >
        <optgroup label="Bins">
          <option value={MASTER}>Master</option>
          {tree.map(({ bin, depth }) => (
            <option key={bin.id} value={`bin:${bin.id}`}>
              {"  ".repeat(depth)}
              {bin.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Smart bins">
          {smart.map(({ id, label }) => (
            <option key={id} value={`smart:${id}`}>
              {label}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
