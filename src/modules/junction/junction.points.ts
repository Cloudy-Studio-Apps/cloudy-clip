import { definePoint } from "@/core";
import type { JunctionKindDefinition } from "./junction.types";

/** Every kind of junction (transitions, a plugin's). Keyed by `kind`. */
export const junctionKinds = definePoint<JunctionKindDefinition>("junction.kinds", {
  keyOf: (k) => k.kind,
});
