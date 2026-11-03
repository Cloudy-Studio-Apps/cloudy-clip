import { orderedTracks, type ProjectState, type TrackKind } from "@/modules/project";

/**
 * The name of a new track of `kind` in a composition: `Video n` / `Audio n`, n being one more than
 * the tracks of that kind. With a `base` (a module's own kind of track, like a voice), the first
 * `<base> n` no track of that kind is called yet: `Voice 1`, `Voice 2`…
 */
export function nextTrackName(
  state: ProjectState,
  compositionId: string,
  kind: TrackKind,
  base?: string,
): string {
  const tracks = orderedTracks(state, compositionId).filter((t) => t.kind === kind);
  if (base === undefined) return `${kind === "video" ? "Video" : "Audio"} ${tracks.length + 1}`;
  const taken = new Set(tracks.map((t) => t.name));
  let n = 1;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}
