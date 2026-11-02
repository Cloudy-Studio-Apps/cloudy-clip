import type { Draft } from "immer";
import type { FieldChange, StorePolicy } from "@/core";
import type { Clip, CompositionId, ProjectState, TrackId } from "../project.types";
import { contains, settleCompositions } from "./compositions";
import { findLayoutConflict, staleJunctions } from "./junctions";

/** Collections of records compared field by field. */
const RECORDS = ["compositions", "clips", "tracks", "junctions", "bins", "solids"] as const;

/** Derived from `clip.trackId`, `clip.start` and `track.compositionId`, so never fields of their own. */
const DERIVED_FIELDS = new Set(["clipIds", "trackOrder"]);

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
  const held = new Map<CompositionId, Set<TrackId>>();
  for (const track of Object.values(draft.tracks)) {
    held.set(track.compositionId, (held.get(track.compositionId) ?? new Set()).add(track.id));
  }
  for (const composition of Object.values(draft.compositions)) {
    composition.trackOrder = reconcile(
      composition.trackOrder,
      held.get(composition.id) ?? new Set(),
    );
  }
  draft.compositionOrder = reconcile(
    draft.compositionOrder,
    new Set(Object.keys(draft.compositions)),
  );
  draft.mediaOrder = reconcile(draft.mediaOrder, new Set(Object.keys(draft.media)));
  draft.binOrder = reconcile(draft.binOrder, new Set(Object.keys(draft.bins)));
  draft.solidOrder = reconcile(draft.solidOrder, new Set(Object.keys(draft.solids)));
}

/** What's wrong with the bins, if anything: an item or bin pointing nowhere, or a bin in itself. */
function binProblem(state: ProjectState): string | null {
  for (const item of [...Object.values(state.media), ...Object.values(state.solids)]) {
    if (item.binId !== undefined && !state.bins[item.binId]) {
      return "an item would be left without its bin";
    }
  }
  for (const bin of Object.values(state.bins)) {
    const seen = new Set([bin.id]);
    for (let at = bin.parentId; at !== null; at = state.bins[at]!.parentId) {
      if (!state.bins[at]) return "a bin would be left without its parent";
      if (seen.has(at)) return "a bin would be inside itself";
      seen.add(at);
    }
  }
  return null;
}

/** A fade never outlasts its clip, whatever trimmed it. */
function clampFades(draft: Draft<ProjectState>): void {
  for (const clip of Object.values(draft.clips)) {
    const sound = clip.sound;
    if (!sound) continue;
    if (sound.fadeIn > clip.duration) sound.fadeIn = clip.duration;
    if (sound.fadeOut > clip.duration) sound.fadeOut = clip.duration;
  }
}

function validate(state: ProjectState): string | null {
  const bins = binProblem(state);
  if (bins) return bins;
  const main = state.mainCompositionId;
  const empty = Object.keys(state.compositions).length === 0;
  if (empty ? main !== null : main === null || !state.compositions[main]) {
    return "the project would have no main composition";
  }
  for (const track of Object.values(state.tracks)) {
    if (!state.compositions[track.compositionId]) {
      return "a track would be left without its composition";
    }
  }
  for (const clip of Object.values(state.clips)) {
    if (!state.tracks[clip.trackId]) return "a clip would be left without its track";
    if (clip.compositionRef !== undefined) {
      if (!state.compositions[clip.compositionRef]) {
        return "a clip would be left without its composition";
      }
      const home = state.tracks[clip.trackId]!.compositionId;
      if (contains(state, clip.compositionRef, home)) {
        return "a composition would be inside itself";
      }
    }
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

/** With Extend to fit on, `duration` follows the clips, so editing a clip must not conflict over it. */
function isDerivedDuration(change: FieldChange, before: ProjectState, after: ProjectState) {
  const [collection, id, field] = change.path;
  if (collection !== "compositions" || field !== "duration" || id === undefined) return false;
  return !!before.compositions[id]?.extendToFit && !!after.compositions[id]?.extendToFit;
}

/** How the project's steps are undone out of order (see `StorePolicy`). */
export const projectPolicy: StorePolicy<ProjectState> = {
  diff(before, after) {
    const out: FieldChange[] = [];
    for (const name of RECORDS) diffCollection(name, before[name], after[name], true, out);
    diffCollection("media", before.media, after.media, false, out);
    if (before.mainCompositionId !== after.mainCompositionId) {
      out.push({
        path: ["mainCompositionId"],
        before: before.mainCompositionId,
        after: after.mainCompositionId,
      });
    }
    return out.filter((change) => !isDerivedDuration(change, before, after));
  },
  repair,
  validate,
  settle(draft) {
    settleCompositions(draft);
    clampFades(draft);
  },
};
