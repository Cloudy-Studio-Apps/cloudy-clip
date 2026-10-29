import { useModule } from "@/core";
import { fontsRef, type FontFamily } from "@/modules/fonts";
import type { Clip } from "@/modules/project";
import type { FontWeight } from "@/modules/fonts";
import { SegmentedControl, SelectField, ToggleRow } from "@/ui";
import { availableWeights, hasItalic, pickVariant } from "../logic/fontpick";
import { FontPicker } from "./FontPicker";
import { StyleSlider } from "./StyleSlider";
import { useFamilies } from "./text.fonts.hook";
import { useTextLive } from "./text.live.hook";
import { useTextStyle } from "./text.style.hook";

const WEIGHT_NAME: Record<FontWeight, string> = {
  "100": "Thin",
  "200": "Extra light",
  "300": "Light",
  "400": "Regular",
  "500": "Medium",
  "600": "Semi bold",
  "700": "Bold",
  "800": "Extra bold",
  "900": "Black",
};

const ALIGNS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
] as const;

/** Family, size, weight, italic, spacing, alignment and uppercase. */
export function TextFontSection({ clip }: { clip: Clip }) {
  const style = useTextStyle(clip);
  const live = useTextLive(clip);
  const fonts = useModule(fontsRef);
  const families = useFamilies();
  const family = families.find(
    (f) => f.family === style?.font.family && f.source === style.font.source,
  );
  if (!style) return null;

  const change = (target: FontFamily | undefined, weight: FontWeight, italic: boolean) => {
    const face = pickVariant(target, { weight, style: italic ? "italic" : "normal" });
    const font = target ? { family: target.family, source: target.source } : style.font;
    void fonts.load({ ...font, ...face });
    live.commit({ font, weight: face.weight, italic: face.style === "italic" });
  };

  return (
    <>
      <FontPicker style={style} onPick={(next) => change(next, style.weight, style.italic)} />
      <StyleSlider
        clip={clip}
        label="Size"
        value={Math.round(style.size)}
        min={8}
        max={400}
        step={1}
        unit="px"
        toPatch={(size) => ({ size })}
      />
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-xs text-muted-foreground">Weight</span>
        <SelectField
          label="Weight"
          className="flex-1"
          value={style.weight}
          options={availableWeights(family).map((w) => ({
            value: w,
            label: `${WEIGHT_NAME[w]} ${w}`,
          }))}
          onChange={(w) => change(family, w as FontWeight, style.italic)}
        />
      </div>
      {hasItalic(family) && (
        <ToggleRow
          label="Italic"
          checked={style.italic}
          onChange={(italic) => change(family, style.weight, italic)}
        />
      )}
      <StyleSlider
        clip={clip}
        label="Letters"
        value={Math.round(style.letterSpacing * 10) / 10}
        min={-20}
        max={100}
        step={0.5}
        unit="px"
        toPatch={(letterSpacing) => ({ letterSpacing })}
      />
      <StyleSlider
        clip={clip}
        label="Lines"
        value={style.lineHeight}
        min={0.8}
        max={2.5}
        step={0.05}
        unit="×"
        toPatch={(lineHeight) => ({ lineHeight })}
      />
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-xs text-muted-foreground">Align</span>
        <SegmentedControl
          label="Align"
          options={ALIGNS}
          value={style.align}
          onChange={(align) => live.commit({ align })}
        />
      </div>
      <ToggleRow
        label="Uppercase"
        checked={style.uppercase}
        onChange={(uppercase) => live.commit({ uppercase })}
      />
    </>
  );
}
