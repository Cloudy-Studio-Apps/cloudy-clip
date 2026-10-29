/**
 * Junction module: kinds of junction (what sits on the cut between two adjacent clips), declared
 * once with `defineJunctionKind`, and the registry that reads them.
 * @module junction
 */
/** Point: kinds of junction. */
export { junctionKinds } from "./junction.points";
/** Declares a kind of junction. */
export { defineJunctionKind } from "./logic/define";
export type {
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
