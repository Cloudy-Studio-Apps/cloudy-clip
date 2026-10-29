import type { Clip, TextStylePatch } from "@/modules/project";
import { SliderField } from "@/ui";
import { useTextLive } from "./text.live.hook";

interface StyleSliderProps {
  clip: Clip;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  /** The style patch for a value. */
  toPatch(value: number): TextStylePatch;
}

/** A slider on one style number: the drag shows live in the preview, the release is one undo step. */
export function StyleSlider({ clip, toPatch, ...field }: StyleSliderProps) {
  const live = useTextLive(clip);
  return (
    <SliderField
      {...field}
      onInput={(value) => live.input(toPatch(value))}
      onCommit={(value) => live.commit(toPatch(value))}
    />
  );
}
