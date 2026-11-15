import { definePoint } from "@/core";
import type { LookDef } from "./tint.types";

/** Every look (built-in and a plugin's), keyed by `id`. The Looks tab and `tint.applyLook` read it. */
export const tintLooks = definePoint<LookDef>("tint.looks", { keyOf: (look) => look.id });
