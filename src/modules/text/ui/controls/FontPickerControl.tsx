import { useModule } from "@/core";
import { fontsRef, type FontFamily } from "@/modules/fonts";
import { FieldRow, type FieldControlProps } from "@/modules/inspector";
import { pickVariant } from "../../logic/fontpick";
import type { TextStyle } from "../../text.types";
import { FontPicker } from "../FontPicker";

/** The `font-picker` control: the family button and its searchable list; keeps the closest face. */
export function FontPickerControl({ values, label, live, disabled }: FieldControlProps) {
  const fonts = useModule(fontsRef);
  const style = values as unknown as TextStyle;
  const pick = (family: FontFamily) => {
    const face = pickVariant(family, {
      weight: style.weight,
      style: style.italic ? "italic" : "normal",
    });
    const font = { family: family.family, source: family.source };
    void fonts.load({ ...font, ...face });
    live.commit({ font, weight: face.weight, italic: face.style === "italic" });
  };
  return (
    <FieldRow label={label}>
      <FontPicker style={style} onPick={pick} disabled={disabled} />
    </FieldRow>
  );
}
