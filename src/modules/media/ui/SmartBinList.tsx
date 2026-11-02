import { CalendarDays, Clapperboard, Film, Image, Music, type LucideIcon } from "lucide-react";
import { useStore } from "zustand";
import { useModule, usePoint } from "@/core";
import { libraryKinds } from "../media.points";
import { mediaRef } from "../media.ref";
import { countAt, useLibrarySource } from "./library.rows.hook";
import { TreeRow } from "./TreeRow";

/** The bins that fill themselves. */
export const SMART_BINS: readonly { id: string; label: string; icon: LucideIcon }[] = [
  { id: "videos", label: "Videos", icon: Film },
  { id: "audio", label: "Audio", icon: Music },
  { id: "images", label: "Images", icon: Image },
  { id: "compositions", label: "Compositions", icon: Clapperboard },
  { id: "today", label: "Imported today", icon: CalendarDays },
];

/** Lists across all bins: by kind of file, and any kind a module adds to the library. */
export function SmartBinList() {
  const { view } = useModule(mediaRef);
  const place = useStore(view, (s) => s.place);
  const source = useLibrarySource();
  const kinds = usePoint(libraryKinds);
  const bins = [
    ...SMART_BINS,
    ...kinds.map(({ type, label, icon }) => ({ id: type, label, icon })),
  ];
  return (
    <section className="flex shrink-0 flex-col pb-1.5">
      <h2 className="flex h-8 items-center px-3 font-hand text-[13.5px] font-bold">Smart bins</h2>
      {bins.map(({ id, label, icon }) => {
        const smart = { kind: "smart", id } as const;
        return (
          <TreeRow
            key={id}
            icon={icon}
            label={label}
            count={countAt(source, smart)}
            active={place.kind === "smart" && place.id === id}
            onClick={() => view.setState({ place: smart })}
          />
        );
      })}
    </section>
  );
}
