import type { Clip } from "@/modules/project";
import { ToggleRow } from "@/ui";
import { StyleColor } from "./StyleColor";
import { StyleSlider } from "./StyleSlider";
import { useTextLive } from "./text.live.hook";
import { useTextStyle } from "./text.style.hook";

/** A soft shadow under the letters. */
export function TextShadowSection({ clip }: { clip: Clip }) {
  const style = useTextStyle(clip);
  const live = useTextLive(clip);
  if (!style) return null;
  const { shadow } = style;
  return (
    <ToggleRow
      label="Shadow"
      checked={shadow.enabled}
      onChange={(enabled) => live.commit({ shadow: { enabled } })}
    >
      <StyleColor
        clip={clip}
        label="Color"
        color={shadow.color}
        opacity={shadow.opacity}
        toPatch={(color, opacity) => ({ shadow: { color, opacity } })}
      />
      <StyleSlider
        clip={clip}
        label="Blur"
        value={Math.round(shadow.blur * 10) / 10}
        min={0}
        max={100}
        step={0.5}
        unit="px"
        toPatch={(blur) => ({ shadow: { blur } })}
      />
      <StyleSlider
        clip={clip}
        label="Distance"
        value={Math.round(shadow.distance * 10) / 10}
        min={0}
        max={100}
        step={0.5}
        unit="px"
        toPatch={(distance) => ({ shadow: { distance } })}
      />
      <StyleSlider
        clip={clip}
        label="Angle"
        value={Math.round(shadow.angle)}
        min={0}
        max={360}
        step={1}
        unit="°"
        toPatch={(angle) => ({ shadow: { angle } })}
      />
    </ToggleRow>
  );
}
