import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule, usePoint } from "@/core";
import { projectRef } from "@/modules/project";
import { libraryRows } from "../logic/library";
import { libraryKinds } from "../media.points";
import { mediaRef } from "../media.ref";
import type { LibraryInput, LibraryPlace, LibraryRow } from "../media.types";

/** What `libraryRows` needs besides a place and a search. Changes with the document only. */
export function useLibrarySource(): Omit<LibraryInput, "place" | "search"> {
  const state = useStore(useModule(projectRef).store.api, (s) => s);
  const kinds = usePoint(libraryKinds);
  return useMemo(
    () => ({
      media: state.media,
      mediaOrder: state.mediaOrder,
      bins: state.bins,
      compositions: state.compositionOrder.flatMap((id) => state.compositions[id] ?? []),
      kinds: kinds.map(({ type, entries }) => ({ type, entries: entries(state) })),
      dayStart: new Date().setHours(0, 0, 0, 0),
    }),
    [state, kinds],
  );
}

/** The rows of the open place, with the search applied. */
export function useLibraryRows(): readonly LibraryRow[] {
  const view = useModule(mediaRef).view;
  const place = useStore(view, (s) => s.place);
  const search = useStore(view, (s) => s.search);
  const source = useLibrarySource();
  return useMemo(() => libraryRows({ ...source, place, search }), [source, place, search]);
}

/** How many rows a place holds, without any search. */
export function countAt(
  source: Omit<LibraryInput, "place" | "search">,
  place: LibraryPlace,
): number {
  return libraryRows({ ...source, place, search: "" }).length;
}

/** The media used by any clip, as a set that stays the same until that changes. */
export function useUsedMedia(): ReadonlySet<string> {
  const used = useStore(useModule(projectRef).store.api, (s) => {
    const ids = new Set(Object.values(s.clips).flatMap((clip) => clip.mediaId ?? []));
    return [...ids].sort().join("\n");
  });
  return useMemo(() => new Set(used.split("\n")), [used]);
}
