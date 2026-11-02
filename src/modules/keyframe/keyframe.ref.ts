import { defineModuleRef } from "@/core";
import type { KeyframeApi } from "./keyframe.types";

/** Handle of the keyframe module: pass it to `require` / `useModule`. */
export const keyframeRef = defineModuleRef<KeyframeApi>("keyframe");
