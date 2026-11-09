import { useSyncExternalStore } from "react";
import { useModule } from "@/core";
import type { ClipId } from "@/modules/project";
import { tintRef } from "../tint.ref";
import type { StripClip } from "../tint.types";
import { useStrip } from "./strip.hook";

/** The clip being graded (re-renders when it changes, not per frame). */
export function useCurrentClip(): ClipId | null {
  const tint = useModule(tintRef);
  return useSyncExternalStore((listener) => tint.onCurrent(() => listener()), tint.current);
}

/** The current clip's strip entry, or null. */
export function useCurrentEntry(): StripClip | null {
  const id = useCurrentClip();
  const strip = useStrip();
  return strip.find((entry) => entry.clip.id === id) ?? null;
}
