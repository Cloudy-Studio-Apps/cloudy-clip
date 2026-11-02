import type { BinId, MediaAsset, MediaKind } from "@/modules/project";
import type { LibraryInput, LibraryPlace, LibraryRow } from "../media.types";

const KIND_OF_BIN: Record<string, MediaKind> = { videos: "video", audio: "audio", images: "image" };
const INFO_TEXT = ["camera", "reel", "scene", "shot", "take", "tag", "comments"] as const;

function matches(asset: MediaAsset, words: string): boolean {
  const fields = [asset.name, ...INFO_TEXT.map((field) => asset.info?.[field] ?? "")];
  return fields.some((field) => field.toLowerCase().includes(words));
}

/** Where the rows come from: a bin that's gone, deleted or from another project, means Master. */
function binOf(place: LibraryPlace & { kind: "bin" }, input: LibraryInput): BinId | null {
  return place.binId !== null && input.bins[place.binId] ? place.binId : null;
}

/**
 * What the library shows at a place, in order. A bin lists what's directly in it; Master is what
 * has no bin. A smart bin lists across all bins. Search looks at names and notes, ignoring case.
 */
export function libraryRows(input: LibraryInput): LibraryRow[] {
  const { place, media, mediaOrder, compositions, kinds, dayStart } = input;
  const words = input.search.trim().toLowerCase();
  const assets = mediaOrder.flatMap((id) => media[id] ?? []);
  const fileRow = ({ id, name }: MediaAsset): LibraryRow => ({ type: "media", id, name });
  const fits = (asset: MediaAsset) => words === "" || matches(asset, words);
  const named = (row: { name: string }) => row.name.toLowerCase().includes(words);

  if (place.kind === "bin") {
    const binId = binOf(place, input);
    const here = (item: { binId?: BinId }) => (item.binId ?? null) === binId;
    return [
      ...assets.filter((asset) => here(asset) && fits(asset)).map(fileRow),
      ...kinds.flatMap(({ type, entries }) =>
        entries
          .filter((entry) => here(entry) && named(entry))
          .map(({ id, name }) => ({ type, id, name })),
      ),
    ];
  }
  const { id } = place;
  if (id === "compositions") {
    return compositions.filter(named).map(({ id, name }) => ({ type: "composition", id, name }));
  }
  if (id === "today") {
    return assets
      .filter((asset) => (asset.importedAt ?? 0) >= dayStart && fits(asset))
      .map(fileRow);
  }
  const kind = KIND_OF_BIN[id];
  if (kind) return assets.filter((asset) => asset.kind === kind && fits(asset)).map(fileRow);
  const entries = kinds.find(({ type }) => type === id)?.entries ?? [];
  return entries.filter(named).map(({ id: entryId, name }) => ({ type: id, id: entryId, name }));
}
