import type { Draft } from "immer";
import type { FieldChange, StorePolicy } from "@/core";
import type { Clip, ProjectState, TrackId } from "../project.types";
import { findLayoutConflict, staleJunctions } from "./junctions";

/** Collections of records compared field by field. */
const RECORDS = ["clips", "tracks", "junctions"] as const;

/** Derived from `clip.trackId` and `clip.start`, so never a field of its own. */
const DERIVED_FIELDS = new Set(["clipIds"]);

function isPlain(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => same(item, b[i]));
  }
  if (!isPlain(a) || !isPlain(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length && keys.every((key) => key in b && same(a[key], b[key]))
  );
}

/** The fields of two values of one record, going one level into plain objects. */
function diffFields(
  path: readonly string[],
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  into: boolean,
  out: FieldChange[],
): void {
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (into && DERIVED_FIELDS.has(key)) continue;
    const from = before[key];
    const to = after[key];
    if (same(from, to)) continue;
    if (into && isPlain(from) && isPlain(to)) diffFields([...path, key], from, to, false, out);
    else out.push({ path: [...path, key], before: from, after: to });
  }
}

function diffCollection(
  name: string,
  before: Record<string, object>,
  after: Record<string, object>,
  fieldLevel: boolean,
  out: FieldChange[],
): void {
  if (before === after) return;
  for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const from = before[id];
    const to = after[id];
    if (from === to) continue;
    if (!from || !to || !fieldLevel) {
      if (!same(from, to)) out.push({ path: [name, id], before: from, after: to });
    } else {
      diffFields([name, id], { ...from }, { ...to }, true, out);
    }
  }
}

/** Keeps `order` in step with `ids`: drops the missing, appends the new. */
function reconcile(order: string[], ids: Set<string>): string[] {
  const kept = order.filter((id) => ids.has(id));
  const seen = new Set(kept);
  return [...kept, ...[...ids].filter((id) => !seen.has(id))];
}

function repair(draft: Draft<ProjectState>): void {
  const clips = Object.values(draft.clips) as Clip[];
  const onTrack = new Map<TrackId, Clip[]>();
  for (const clip of clips) onTrack.set(clip.trackId, [...(onTrack.get(clip.trackId) ?? []), clip]);
  for (const track of Object.values(draft.tracks)) {
    const here = onTrack.get(track.id) ?? [];
    track.clipIds = here.sort((a, b) => a.start - b.start).map((clip) => clip.id);
  }
  draft.trackOrder = reconcile(draft.trackOrder, new Set(Object.keys(draft.tracks)));
  draft.mediaOrder = reconcile(draft.mediaOrder, new Set(Object.keys(draft.media)));
}

function validate(state: ProjectState): string | null {
  for (const clip of Object.values(state.clips)) {
    if (!state.tracks[clip.trackId]) return "a clip would be left without its track";
    if (clip.mediaId !== undefined && !state.media[clip.mediaId]) {
      return "a clip would be left without its media";
    }
  }
  if (findLayoutConflict(state)) return "clips would overlap";
  if (staleJunctions(state).length > 0) return "a transition would no longer fit its clips";
  const cuts = new Set<string>();
  for (const junction of Object.values(state.junctions)) {
    const cut = `${junction.leftClipId}|${junction.rightClipId}`;
    if (cuts.has(cut)) return "a cut would have two transitions";
    cuts.add(cut);
  }
  return null;
}

/** How the project's steps are undone out of order (see `StorePolicy`). */
export const projectPolicy: StorePolicy<ProjectState> = {
  diff(before, after) {
    const out: FieldChange[] = [];
    for (const name of RECORDS) diffCollection(name, before[name], after[name], true, out);
    diffCollection("media", before.media, after.media, false, out);
    if (!same(before.format, after.format)) {
      diffFields(["format"], { ...before.format }, { ...after.format }, false, out);
    }
    return out;
  },
  repair,
  validate,
};
