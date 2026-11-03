import {
  DEFAULT_SOUND,
  type SoundEffect,
  type SoundEffectKind,
  type TrackId,
} from "@/modules/project";
import type { EffectSpec } from "../sound.types";

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
