import { useCallback } from "react";
import { useKernel, useModule } from "@/core";
import { mediaRef } from "../media.ref";
import { pickMedia } from "./media.pick";

/** `pickMedia`, ready to call from a component. */
export function usePickMedia(): (options?: { defaultPath?: string }) => Promise<void> {
  const { bus } = useKernel();
  const { view } = useModule(mediaRef);
  return useCallback((options) => pickMedia(bus, view, options), [bus, view]);
}
