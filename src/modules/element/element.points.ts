import { definePoint } from "@/core";
import type { AnyElement, PropType, SharedGroup } from "./element.types";

/** Every kind of clip (text, media, a plugin's). Keyed by `kind`. */
export const elements = definePoint<AnyElement>("element.elements", { keyOf: (e) => e.kind });

/** Property groups elements opt into with `supports` (transform). Keyed by `id`. */
export const sharedGroups = definePoint<SharedGroup>("element.sharedGroups", {
  keyOf: (g) => g.id,
});

/** Custom value types for `prop.custom` (font). Keyed by `name`. */
export const propTypes = definePoint<PropType>("element.propTypes", { keyOf: (t) => t.name });
