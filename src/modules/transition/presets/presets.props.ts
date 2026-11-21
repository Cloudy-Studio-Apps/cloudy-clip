import { prop } from "@/modules/element";
import { EASE_PRESETS } from "@/modules/project";

/** The "Ease" option: one of the keyframe ease presets. Read it with `eased`. */
export const easeProp = () =>
  prop.enum(EASE_PRESETS.map((p) => p.id) as [string, ...string[]], { label: "Ease" });

/** A 0..1 slider labelled "Intensity". */
export const intensityProp = () =>
  prop.number({ min: 0, max: 1, step: 0.01, control: "slider", label: "Intensity" });

/** A 0..1 slider labelled "Softness". */
export const softnessProp = () =>
  prop.number({ min: 0, max: 1, step: 0.01, control: "slider", label: "Softness" });
