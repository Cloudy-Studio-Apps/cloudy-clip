import {
  DEFAULT_SOUND,
  SOUND_EFFECT_KINDS,
  compositionMixOf,
  trackMixOf,
  type CompositionId,
  type MixBus,
  type ProjectState,
  type SoundEffect,
  type SoundEffectKind,
  type TrackId,
} from "@/modules/project";
import type { ChainWhere, EffectSpecOf, ListenNodes, MixTarget } from "../sound.types";

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

/** The kinds `+ Effect` offers on a chain: those not in it yet, and no ducking on the master. */
export function addableKinds(chain: readonly SoundEffect[], target: MixTarget): SoundEffectKind[] {
  return SOUND_EFFECT_KINDS.filter(
    (kind) => !chain.some((e) => e.kind === kind) && !(target === "master" && kind === "duck"),
  );
}

/** No effects: one array, so a selector that finds none returns the same thing each time. */
const NO_EFFECTS: readonly SoundEffect[] = [];

/**
 * The chain of a track, of a composition's master or of one of its groups, as stored (the same
 * array while it doesn't change); empty when it has none or doesn't exist.
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
  const track = state.tracks[target];
  if (track) return track.mix?.effects ?? NO_EFFECTS;
  const composition = compositionId && state.compositions[compositionId];
  return (
    (composition && composition.mix?.buses?.find((b) => b.id === target)?.effects) || NO_EFFECTS
  );
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

/**
 * The input that says which chain a command acts on: the track, or the master of `compositionId`
 * (left out when unknown, so the command takes the actor's open composition).
 */
export function chainWhere(
  target: MixTarget,
  compositionId: CompositionId | undefined,
): ChainWhere {
  return { target, ...(target === "master" && compositionId && { compositionId }) };
}

/** What each kind starts with: a fresh copy each call. */
const DEFAULT_SPECS: { [K in SoundEffectKind]: () => EffectSpecOf<K> } = {
  eq: () => ({ kind: "eq", on: true, bands: DEFAULT_SOUND.eq.bands.map((band) => ({ ...band })) }),
  compressor: () => ({
    kind: "compressor",
    on: true,
    params: { thresholdDb: -18, ratio: 3, attackMs: 10, releaseMs: 120, kneeDb: 6, makeupDb: 0 },
  }),
  gate: () => ({ kind: "gate", on: true, thresholdDb: -50, ratio: 4, attackMs: 5, releaseMs: 120 }),
  deesser: () => ({ kind: "deesser", on: true, frequencyHz: 6500, amount: 0.5 }),
  limiter: () => ({ kind: "limiter", on: true, ceilingDb: -1, releaseMs: 50 }),
  denoise: () => ({ kind: "denoise", on: true, amountDb: 12, floorDb: -50 }),
  duck: () => ({
    kind: "duck",
    on: true,
    listensTo: [],
    depthDb: -9,
    attackMs: 20,
    releaseMs: 300,
  }),
};

/** The settings a new effect of this kind starts with (without an id). */
export function defaultSpec<K extends SoundEffectKind>(kind: K): EffectSpecOf<K> {
  return DEFAULT_SPECS[kind]();
}

const heardBy = (effects: readonly SoundEffect[] | undefined): string[] =>
  (effects ?? []).flatMap((e) => (e.kind === "duck" ? e.listensTo : []));

/**
 * What each track and group depends on, `except` left out (the one being changed): a track on the
 * tracks and groups its ducks listen to; a group on those too, and on every track sent to it.
 */
export function listenGraph(
  tracks: ListenNodes,
  except: string,
  buses: readonly MixBus[] = [],
): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const [id, track] of Object.entries(tracks)) {
    if (id === except) continue;
    const heard = heardBy(track.mix?.effects);
    if (heard.length) graph.set(id, heard);
  }
  for (const bus of buses) {
    if (bus.id === except) continue;
    const members = Object.entries(tracks).flatMap(([id, t]) =>
      t.mix?.busId === bus.id ? [id] : [],
    );
    const heard = [...heardBy(bus.effects), ...members];
    if (heard.length) graph.set(bus.id, heard);
  }
  return graph;
}

/**
 * Whether `owner` (a track or a group) listening to `listensTo` would close a loop: a listened
 * track or group is the owner, or depends on it (through any number of ducks and group
 * memberships). The owner's own current ducks are not counted, since the new list replaces them.
 */
export function closesLoop(
  tracks: ListenNodes,
  owner: string,
  listensTo: readonly string[],
  buses: readonly MixBus[] = [],
): boolean {
  const graph = listenGraph(tracks, owner, buses);
  const seen = new Set<string>();
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

/** The ids a track's own ducks listen to. */
export function listensOf(track: { mix?: { effects?: SoundEffect[] } }): string[] {
  return heardBy(track.mix?.effects);
}
