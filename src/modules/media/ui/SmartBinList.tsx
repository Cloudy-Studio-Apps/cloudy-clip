import { CalendarDays, Clapperboard, Film, Image, Music, type LucideIcon } from "lucide-react";
import { useStore } from "zustand";
import { useModule, usePoint, type PanelIcon } from "@/core";
import { cn } from "@/ui";
import { libraryKinds } from "../media.points";
import { mediaRef } from "../media.ref";
import { countAt, useLibrarySource } from "./library.rows.hook";

/** The bins that fill themselves. */
export const SMART_BINS: readonly { id: string; label: string; icon: LucideIcon }[] = [
  { id: "videos", label: "Videos", icon: Film },
  { id: "audio", label: "Audio", icon: Music },
  { id: "images", label: "Images", icon: Image },
  { id: "compositions", label: "Compositions", icon: Clapperboard },
  { id: "today", label: "Imported today", icon: CalendarDays },
];

/** A line of the sidebar: icon, name, count. */
export function TreeRow({
  icon: Icon,
  label,
  count,
  active,
  depth = 0,
  onClick,
}: {
  icon: PanelIcon;
  label: string;
  count?: number;
  active: boolean;
  depth?: number;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      style={{ paddingLeft: 12 + depth * 16 }}
      className={cn(
        "flex h-7 w-full shrink-0 cursor-pointer items-center gap-1.5 pr-3 text-left",
        active
          ? "bg-surface text-foreground shadow-[inset_2px_0_0_var(--mark)]"
          : "text-muted-foreground hover:bg-hover hover:text-foreground",
      )}
      onClick={onClick}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && (
        <small className="font-mono text-[11.5px] text-subtle-foreground">{count}</small>
      )}
    </button>
  );
}

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
