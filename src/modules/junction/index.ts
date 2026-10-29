/**
 * Junction module: kinds of junction (what sits on the cut between two adjacent clips), declared
 * once with `defineJunctionKind`, and the registry that reads them.
 * @module junction
 */
/** Point: kinds of junction. */
export { junctionKinds } from "./junction.points";
/** Declares a kind of junction. */
export { defineJunctionKind } from "./logic/define";
/** Limits for a kind's junction between two clips (`{0,0,0}` when the kind doesn't overlap). */
export { clampDuration, durationLimits } from "./logic/limits";
/**
 * Fails with `junction.invalid_duration` (the allowed range in the message) unless a duration is
 * within a kind's limits; for commands of other modules that change joined clips.
 */
export { checkDuration } from "./junction.guards";
/** The cut between two adjacent clips of a track, near a time or after a clip. */
export { cutAfter, cutNear } from "./logic/cut";
/** Junction commands. */
export { addJunction, removeJunction, setJunction } from "./junction.commands";
export type {
  Cut,
  DurationLimits,
  JunctionApi,
  JunctionDisplay,
  JunctionKindDefinition,
  MixEnv,
  MixFn,
  NormalizeEnv,
  OverlapRule,
  ResolvedJunctionKind,
} from "./junction.types";

/** Module definition, loaded by the app shell. */
export { junctionModule } from "./junction.module";
/** Handle for `require(junctionRef)` / `useModule(junctionRef)`. */
export { junctionRef } from "./junction.ref";
