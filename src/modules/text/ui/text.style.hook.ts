import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { isTextClip, projectRef, textStyleOf, type Clip, type TextStyle } from "@/modules/project";

/** The style a text clip is drawn with (its own or the default), or null for another kind of clip. */
export function useTextStyle(clip: Clip): TextStyle | null {
  const format = useStore(useModule(projectRef).store.api, (s) => s.format);
  return useMemo(() => (isTextClip(clip) ? textStyleOf(clip, format) : null), [clip, format]);
}
