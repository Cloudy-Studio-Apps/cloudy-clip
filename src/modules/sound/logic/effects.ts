import {
  DEFAULT_SOUND,
  SOUND_EFFECT_KINDS,
  compositionMixOf,
  trackMixOf,
  type CompositionId,
  type ProjectState,
  type SoundEffect,
  type SoundEffectKind,
  type TrackId,
} from "@/modules/project";
import type { EffectSpec, MixTarget } from "../sound.types";

/** What each kind is called: in full (the Channel tab) and short (a strip's list). */
export const EFFECT_NAMES: Record<SoundEffectKind, { name: string; short: string }> = {
  eq: { name: "Equalizer", short: "EQ" },
  compressor: { name: "Compressor", short: "Comp" },
  gate: { name: "Noise gate", short: "Gate" },
  deesser: { name: "De-esser", short: "De-ess" },
  limiter: { name: "Limiter", short: "Limiter" },
  denoise: { name: "Noise reduction", short: "Noise red." },
  duck: { name: "Ducking", short: "Ducking" },
};

/**
 * The kinds the user can add and edit on the page, in the order they're listed. Noise reduction
 * is left out until its rendered files play: the page offers no control that does nothing.
 */
export const EDITABLE_KINDS: readonly SoundEffectKind[] = SOUND_EFFECT_KINDS.filter(
  (kind) => kind !== "denoise",
);

/** The kinds `+ Effect` offers on a chain: those not in it yet, and no ducking on the master. */
export function addableKinds(chain: readonly SoundEffect[], target: MixTarget): SoundEffectKind[] {
  return EDITABLE_KINDS.filter(
    (kind) => !chain.some((e) => e.kind === kind) && !(target === "master" && kind === "duck"),
  );
}

/** No effects: one array, so a selector that finds none returns the same thing each time. */
const NO_EFFECTS: readonly SoundEffect[] = [];

/**
 * The chain of a track or of a composition's master, as stored (the same array while it doesn't
 * change); empty when it has none or doesn't exist.
 */
export function chainOf(
  state: ProjectState,
  target: MixTarget,
  compositionId: CompositionId | undefined,
): readonly SoundEffect[] {
  if (target === "master") {
    const composition = compositionId && state.compositions[compositionId];
    return (composition && composition.mix?.master.effects) || NO_EFFECTS;
  }
  return state.tracks[target]?.mix?.effects ?? NO_EFFECTS;
}

/**
 * Whether a track places a composition (at any depth) that has effects of its own. Those aren't
 * heard from outside: the placement sounds through its inner clips only.
 */
export function placesUnheardEffects(state: ProjectState, trackId: TrackId): boolean {
  const seen = new Set<CompositionId>();
  const placedIn = (track: { clipIds: readonly string[] }): CompositionId[] =>
    track.clipIds.flatMap((id) => {
      const ref = state.clips[id]?.compositionRef;
      return ref === undefined ? [] : [ref];
    });
  const stack = placedIn(state.tracks[trackId] ?? { clipIds: [] });
  while (stack.length) {
    const id = stack.pop()!;
    const composition = state.compositions[id];
    if (seen.has(id) || !composition) continue;
    seen.add(id);
    if (compositionMixOf(composition).master.effects?.length) return true;
    for (const inner of composition.trackOrder) {
      const track = state.tracks[inner];
      if (!track) continue;
      if (trackMixOf(track).effects?.length) return true;
      stack.push(...placedIn(track));
    }
  }
  return false;
}

/** The settings a new effect of this kind starts with (without an id). */
export function defaultSpec(kind: SoundEffectKind): EffectSpec {
  switch (kind) {
    case "eq":
      return { kind, on: true, bands: DEFAULT_SOUND.eq.bands.map((band) => ({ ...band })) };
    case "compressor":
      return {
        kind,
        on: true,
        params: {
          thresholdDb: -18,
          ratio: 3,
          attackMs: 10,
          releaseMs: 120,
          kneeDb: 6,
          makeupDb: 0,
        },
      };
    case "gate":
      return { kind, on: true, thresholdDb: -50, ratio: 4, attackMs: 5, releaseMs: 120 };
    case "deesser":
      return { kind, on: true, frequencyHz: 6500, amount: 0.5 };
    case "limiter":
      return { kind, on: true, ceilingDb: -1, releaseMs: 50 };
    case "denoise":
      return { kind, on: true, amountDb: 12, floorDb: -50 };
    case "duck":
      return { kind, on: true, listensTo: [], depthDb: -9, attackMs: 20, releaseMs: 300 };
  }
}

/** Who each track listens to through its ducks, `except` left out (the track being changed). */
export function listenGraph(
  tracks: Record<TrackId, { mix?: { effects?: SoundEffect[] } }>,
  except: TrackId,
): Map<TrackId, TrackId[]> {
  const graph = new Map<TrackId, TrackId[]>();
  for (const [id, track] of Object.entries(tracks)) {
    if (id === except) continue;
    const heard = (track.mix?.effects ?? []).flatMap((e) => (e.kind === "duck" ? e.listensTo : []));
    if (heard.length) graph.set(id, heard);
  }
  return graph;
}

/**
 * Whether `owner` listening to `listensTo` would close a loop: a listened track is the owner, or
 * hears the owner (through any number of ducks). The owner's own current ducks are not counted,
 * since the new list replaces them.
 */
export function closesLoop(
  tracks: Record<TrackId, { mix?: { effects?: SoundEffect[] } }>,
  owner: TrackId,
  listensTo: readonly TrackId[],
): boolean {
  const graph = listenGraph(tracks, owner);
  const seen = new Set<TrackId>();
  const stack = [...listensTo];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === owner) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(graph.get(id) ?? []));
  }
  return false;
}
