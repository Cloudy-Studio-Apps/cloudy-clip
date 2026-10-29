import type { Clip } from "@/modules/project";
import { StyleColor } from "./StyleColor";
import { useTextStyle } from "./text.style.hook";

/** The color and opacity of the letters. */
export function TextFillSection({ clip }: { clip: Clip }) {
  const style = useTextStyle(clip);
  if (!style) return null;
  return (
    <StyleColor
      clip={clip}
      label="Color"
      color={style.fill.color}
      opacity={style.fill.opacity}
      toPatch={(color, opacity) => ({ fill: { color, opacity } })}
    />
  );
}
