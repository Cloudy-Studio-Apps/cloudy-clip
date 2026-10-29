import { CommandFailure, formatTimecode, type Micros } from "@/core";
import { mergeProps, minimizeProps, resolveProps } from "@/modules/element";
import {
  junctionBetween,
  type Junction,
  type LayoutConflict,
  type ProjectState,
} from "@/modules/project";
import { cutAfter, cutNear } from "./logic/cut";
import type {
  Cut,
  DurationLimits,
  JunctionApi,
  JunctionKindDefinition,
  ResolvedJunctionKind,
} from "./junction.types";

/** The junction, or a `junction.not_found` failure. */
export function requireJunction(state: ProjectState, id: string): Junction {
  const junction = state.junctions[id];
  if (!junction) throw new CommandFailure("junction.not_found", `No junction with id "${id}"`);
  return junction;
}

/** The registered kind, or a `junction.unknown_kind` failure. */
export function requireKind(api: JunctionApi, kind: string): ResolvedJunctionKind {
  const resolved = api.get(kind);
  if (!resolved) {
    const known = api.list().map((k) => k.definition.kind);
    throw new CommandFailure(
      "junction.unknown_kind",
      `No junction kind "${kind}". Available: ${known.join(", ") || "none"}.`,
    );
  }
  return resolved;
}

/**
 * The cut the input names: the pair (`leftClipId`, `rightClipId`) or the cut of `trackId` nearest
 * `at` (within one frame). Fails with `junction.no_cut` when no two clips touch there and with
 * `junction.track_kind` when the kind can't sit on that track.
 */
export function requireCut(
  state: ProjectState,
  input: {
    kind: JunctionKindDefinition;
    leftClipId?: string;
    rightClipId?: string;
    trackId?: string;
    at?: Micros;
  },
): Cut {
  let cut: Cut | undefined;
  if (input.leftClipId !== undefined || input.rightClipId !== undefined) {
    const found = input.leftClipId ? cutAfter(state, input.leftClipId) : undefined;
    if (found && (!input.rightClipId || found.right.id === input.rightClipId)) cut = found;
    if (!cut) {
      throw new CommandFailure(
        "junction.no_cut",
        `Clips "${input.leftClipId}" and "${input.rightClipId}" don't touch on one track (the right clip must start where the left one ends).`,
      );
    }
  } else if (input.trackId !== undefined && input.at !== undefined) {
    if (!state.tracks[input.trackId]) {
      throw new CommandFailure("timeline.track_not_found", `No track with id "${input.trackId}"`);
    }
    cut = cutNear(state, input.trackId, input.at, Math.ceil(1_000_000 / state.format.fps));
    if (!cut) {
      throw new CommandFailure(
        "junction.no_cut",
        `No two clips touch on track "${state.tracks[input.trackId]?.name}" at ${formatTimecode(input.at)}.`,
      );
    }
  } else {
    throw new CommandFailure(
      "junction.no_cut",
      "Name the cut: leftClipId and rightClipId, or trackId and at.",
    );
  }
  const track = state.tracks[cut.trackId];
  if (!track || !input.kind.tracks.includes(track.kind)) {
    throw new CommandFailure(
      "junction.track_kind",
      `${input.kind.name} can't sit on a ${track?.kind} track (allowed: ${input.kind.tracks.join(", ")}).`,
    );
  }
  return cut;
}

/** Fails with `junction.exists` when the pair already has a junction. */
export function requireNoJunction(state: ProjectState, cut: Cut): void {
  const existing = junctionBetween(state, cut.left.id, cut.right.id);
  if (existing) {
    throw new CommandFailure(
      "junction.exists",
      `Clips "${cut.left.id}" and "${cut.right.id}" already have junction "${existing.id}" (${existing.kind}); change it with junction.set.`,
    );
  }
}

/** Fails with `junction.invalid_duration` unless `duration` is within the limits. */
export function checkDuration(
  kind: JunctionKindDefinition,
  duration: Micros,
  limits: DurationLimits,
): void {
  if (duration >= limits.min && duration <= limits.max) return;
  const seconds = (us: Micros) => `${(us / 1_000_000).toFixed(3)} s`;
  throw new CommandFailure(
    "junction.invalid_duration",
    limits.max < limits.min
      ? `${kind.name} doesn't fit between these clips: the shorter one is too short.`
      : `${kind.name} must last between ${seconds(limits.min)} and ${seconds(limits.max)} here (got ${seconds(duration)}).`,
    { min: limits.min, max: limits.max },
  );
}

/**
 * The stored props after `patch`: parsed by the kind's schema (`junction.invalid_props`), merged
 * over `stored`, normalized against `previous`, minimized against the defaults.
 */
export function nextProps(
  resolved: ResolvedJunctionKind,
  state: ProjectState,
  stored: Record<string, unknown>,
  patch: Record<string, unknown>,
  previous: Record<string, unknown>,
): Record<string, unknown> {
  const { definition } = resolved;
  const parsed = resolved.schema.safeParse(patch);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    throw new CommandFailure(
      "junction.invalid_props",
      `${definition.name}: ${where}${issue.message}`,
    );
  }
  const defaults = definition.defaults(state.format);
  const merged = resolveProps(mergeProps(stored, parsed.data as Record<string, unknown>), defaults);
  const next = definition.normalize
    ? definition.normalize(merged, { format: state.format, previous })
    : merged;
  return minimizeProps(next, defaults);
}

/** The failure for a change that would leave `conflict.other` in the way, with where it is. */
export function overlapError(state: ProjectState, conflict: LayoutConflict): CommandFailure {
  const { clip, other } = conflict;
  if (clip === other) {
    return new CommandFailure(
      "junction.overlap",
      `That change would move clip "${clip.id}" before the start of the timeline.`,
      { clipId: clip.id },
    );
  }
  const end = other.start + other.duration;
  return new CommandFailure(
    "junction.overlap",
    `That change would make clip "${clip.id}" overlap clip "${other.id}" (${formatTimecode(other.start)}–${formatTimecode(end)}) on track "${state.tracks[other.trackId]?.name}". Move or remove "${other.id}" first.`,
    { clipId: other.id, start: other.start, end },
  );
}
