import type { FontWeight } from "@/modules/fonts";
import type { FieldControlProps } from "@/modules/inspector";
import { SelectField } from "@/ui";
import { availableWeights, pickVariant } from "../../logic/fontpick";
import { useClipFamily } from "./controls.family.hook";

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
const ALL_WEIGHTS = Object.keys(WEIGHT_NAME) as FontWeight[];

/** The `font-weight` control: only the weights the clip's family has (all while it is unknown). */
export function FontWeightControl({ value, values, label, live, disabled }: FieldControlProps) {
  const family = useClipFamily(values);
  const weights = family ? availableWeights(family) : ALL_WEIGHTS;
  return (
    <SelectField
      label={label}
      className="min-w-0 flex-1"
      value={String(value)}
      disabled={disabled}
      options={weights.map((w) => ({ value: w, label: `${WEIGHT_NAME[w]} ${w}` }))}
      onChange={(next) => {
        const face = pickVariant(family, {
          weight: next as FontWeight,
          style: values.italic === true ? "italic" : "normal",
        });
        live.commit({ weight: face.weight, italic: face.style === "italic" });
      }}
    />
  );
}
