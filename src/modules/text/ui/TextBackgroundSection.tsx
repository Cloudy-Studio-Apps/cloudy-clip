import type { Clip } from "@/modules/project";
import { ToggleRow } from "@/ui";
import { StyleColor } from "./StyleColor";
import { StyleSlider } from "./StyleSlider";
import { useTextLive } from "./text.live.hook";
import { useTextStyle } from "./text.style.hook";

/** A box behind the text. */
export function TextBackgroundSection({ clip }: { clip: Clip }) {
  const style = useTextStyle(clip);
  const live = useTextLive(clip);
  if (!style) return null;
  const { background: bg } = style;
  return (
    <ToggleRow
      label="Background"
      checked={bg.enabled}
      onChange={(enabled) => live.commit({ background: { enabled } })}
    >
      <StyleColor
        clip={clip}
        label="Color"
        color={bg.color}
        opacity={bg.opacity}
        toPatch={(color, opacity) => ({ background: { color, opacity } })}
      />
      <StyleSlider
        clip={clip}
        label="Padding"
        value={Math.round(bg.padding)}
        min={0}
        max={300}
        step={1}
        unit="px"
        toPatch={(padding) => ({ background: { padding } })}
      />
      <StyleSlider
        clip={clip}
        label="Radius"
        value={Math.round(bg.radius)}
        min={0}
        max={300}
        step={1}
        unit="px"
        toPatch={(radius) => ({ background: { radius } })}
      />
    </ToggleRow>
  );
}
