import { definePoint } from "@/core";
import type { KeyTarget } from "./keyframe.types";

/** Everything whose values can be keyed (the element's fields, a module's own). Keyed by `id`. */
export const keyTargets = definePoint<KeyTarget>("keyframe.targets", { keyOf: (t) => t.id });
