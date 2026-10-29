import { z } from "zod";
import type { PointReader } from "@/core";
import { definePropType, patchSchema, propTypes } from "@/modules/element";
import { transitionPresets } from "./transition.points";
import type { TransitionApi } from "./transition.types";

/**
 * The `transition-options` prop type: the options of the chosen preset (checked by the kind, which
 * knows the preset). Edited by the `transition-options` control of the transition tab.
 */
export const transitionOptionsType = definePropType({
  name: "transition-options",
  control: "transition-options",
  schema: () => z.record(z.string(), z.unknown()),
});

/** The transition API of one kernel: presets from the `transitionPresets` point. */
export function createTransitionApi(points: PointReader): TransitionApi {
  return {
    find: (id) => points.find(transitionPresets, id),
    list: () => points.get(transitionPresets),
    optionsSchema: (preset) =>
      patchSchema(preset.properties, {
        propType: (name) => points.find(propTypes, name),
        groups: [],
      }),
  };
}
