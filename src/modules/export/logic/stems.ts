import {
  compositionMixOf,
  trackMixOf,
  type CompositionId,
  type ProjectState,
} from "@/modules/project";
import type { StemPlan } from "../export.types";

/** What the mix's own file is named with when it has stems. */
export const MIX_LABEL = "Mix";

/** What the stem of the tracks sent straight to Master is named with. */
export const OTHER_LABEL = "Other";

/** Characters no file name may hold on Linux or Windows, control characters included. */
// eslint-disable-next-line no-control-regex
const UNSAFE = /[/\\:*?"<>|\u0000-\u001f]/g;

/** A group's name as it can sit in a file name: unsafe characters become `_`, no dots or spaces at the end. */
function safeLabel(name: string): string {
  return name
    .replace(UNSAFE, "_")
    .trim()
    .replace(/[. ]+$/, "");
}

/**
 * The stems of a composition, in the order they're written: one per group, in the composition's
 * order (at any values, muted ones too: their file is silent), then "Other" when some audio track
 * sends straight to Master (or to a group that isn't there, as `mixdown` reads it). Labels are the
 * groups' names made safe for a file name, and unique beside "Mix", "Other" and each other,
 * ignoring case as Windows does: a second "Music" is "Music 2". Solo plays no part.
 */
export function stemsOf(
  project: Pick<ProjectState, "compositions" | "tracks">,
  compositionId: CompositionId,
): StemPlan[] {
  const composition = project.compositions[compositionId];
  if (!composition) return [];
  const buses = compositionMixOf(composition).buses ?? [];
  const ids = new Set(buses.map((bus) => bus.id));
  const other = composition.trackOrder.some((id) => {
    const track = project.tracks[id];
    if (track?.kind !== "audio") return false;
    const { busId } = trackMixOf(track);
    return busId === undefined || !ids.has(busId);
  });
  const taken = new Set([MIX_LABEL.toLowerCase(), ...(other ? [OTHER_LABEL.toLowerCase()] : [])]);
  const stems = buses.map((bus, index): StemPlan => {
    const base = safeLabel(bus.name) || `Group ${index + 1}`;
    let label = base;
    for (let n = 2; taken.has(label.toLowerCase()); n++) label = `${base} ${n}`;
    taken.add(label.toLowerCase());
    return { label, bus: index };
  });
  return other ? [...stems, { label: OTHER_LABEL }] : stems;
}

/**
 * What follows the export's name in each of its files: nothing for a plain export; with stems,
 * ` - Mix` first, then ` - <label>` for each stem.
 */
export function fileSuffixes(stems: readonly StemPlan[] | null): string[] {
  if (!stems) return [""];
  return [` - ${MIX_LABEL}`, ...stems.map(({ label }) => ` - ${label}`)];
}
