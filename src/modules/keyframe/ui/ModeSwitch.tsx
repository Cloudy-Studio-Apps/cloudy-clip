import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { SegmentedControl } from "@/ui";
import { keyframeRef } from "../keyframe.ref";
import { toggleMode } from "../keyframe.view.commands";
import type { KeyframeViewState } from "../keyframe.types";

const OPTIONS = [
  { value: "normal", label: "Normal", hint: "The plain timeline (K switches back and forth)" },
  { value: "keys", label: "Keyframes", hint: "Every key of the selected clips (K)" },
  { value: "curves", label: "Curves", hint: "The same keys as curves (K)" },
] as const;

/** Normal, Keyframes or Curves, at the left of the timeline's toolbar. */
export function ModeSwitch() {
  const { bus } = useKernel();
  const mode = useStore(useModule(keyframeRef).view, (s: KeyframeViewState) => s.mode);
  return (
    <SegmentedControl
      label="Timeline view"
      options={OPTIONS}
      value={mode}
      onChange={(next) => void bus.run(toggleMode, { mode: next })}
    />
  );
}
