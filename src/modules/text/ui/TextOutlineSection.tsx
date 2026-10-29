import type { Clip } from "@/modules/project";
import { ToggleRow } from "@/ui";
import { StyleColor } from "./StyleColor";
import { StyleSlider } from "./StyleSlider";
import { useTextLive } from "./text.live.hook";
import { useTextStyle } from "./text.style.hook";

/** A stroke around the letters. */
export function TextOutlineSection({ clip }: { clip: Clip }) {
  const style = useTextStyle(clip);
  const live = useTextLive(clip);
  if (!style) return null;
  const { outline } = style;
  return (
    <ToggleRow
      label="Outline"
      checked={outline.enabled}
      onChange={(enabled) => live.commit({ outline: { enabled } })}
    >
      <StyleColor
        clip={clip}
        label="Color"
        color={outline.color}
        toPatch={(color) => ({ outline: { color } })}
      />
      <StyleSlider
        clip={clip}
        label="Width"
        value={Math.round(outline.width * 10) / 10}
        min={0}
        max={100}
        step={0.5}
        unit="px"
        toPatch={(width) => ({ outline: { width } })}
      />
    </ToggleRow>
  );
}
