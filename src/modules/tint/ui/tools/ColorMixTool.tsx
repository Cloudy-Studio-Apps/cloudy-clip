import { Pipette } from "lucide-react";
import { useEffect } from "react";
import { MIX_FAMILIES, type CorrectionValues, type MixFamilyName } from "@/modules/project";
import { Button, cn } from "@/ui";
import { notify } from "@/core";
import { hueOf } from "../../logic/color/curves.apply";
import { FAMILY_DEGREES, nearestFamily, withFamily } from "../../logic/color/mix";
import { useToolEdit } from "../tool.edit.hook";
import { useTintView } from "../view.hook";
import { useTintSet } from "../view.set.hook";
import { GradeSlider } from "./GradeSlider";
import { ToolColumn } from "./ToolColumn";
import { ToolColumns } from "./ToolColumns";

/** A family's dot and bar (data colors). */
const swatch = (name: MixFamilyName) => `hsl(${FAMILY_DEGREES[name]} 70% 55%)`;

const title = (name: string) => name[0]!.toUpperCase() + name.slice(1);

const FIELDS = [
  { field: "hue", label: "Hue" },
  { field: "sat", label: "Saturation" },
  { field: "lum", label: "Brightness" },
] as const;

type Mix = CorrectionValues["mix"];

/** Color mix: pick a color family and change its hue, saturation and brightness, on the selected correction. */
export function ColorMixTool() {
  const index = useTintView((v) => v.family);
  const picking = useTintView((v) => v.picking);
  const picked = useTintView((v) => v.picked);
  const set = useTintSet();
  const { values, edit } = useToolEdit();
  const mix = values.mix;
  const name = MIX_FAMILIES[index] ?? MIX_FAMILIES[0];
  const patch = (next: Mix) => ({ values: { mix: next } });

  // A color picked in the viewer chooses the family nearest its hue.
  useEffect(() => {
    if (picked === null) return;
    const hue = hueOf(picked);
    if (hue === null) notify("info", "That color is a gray: it has no hue to pick.");
    set(hue === null ? { picked: null } : { picked: null, family: nearestFamily(hue) });
  }, [picked, set]);

  // Leaving the tool stops a pick that hasn't happened.
  useEffect(() => () => set({ picking: false }), [set]);

  return (
    <ToolColumns key={edit.rev}>
      <ToolColumn
        title="Color family"
        info="Change one color family without picking: greener grass, a calmer sky, warmer skin."
      >
        <div className="mb-4 flex gap-2.5">
          {MIX_FAMILIES.map((family, i) => (
            <button
              key={family}
              type="button"
              title={title(family)}
              aria-pressed={i === index}
              onClick={() => set({ family: i })}
              className={cn(
                "size-[22px] cursor-pointer rounded-full",
                i === index
                  ? "shadow-[0_0_0_2px_var(--surface),0_0_0_3.5px_var(--foreground)]"
                  : "shadow-[0_0_0_1px_var(--border-strong)]",
              )}
              style={{ background: swatch(family) }}
            />
          ))}
        </div>
        <Button
          size="sm"
          disabled={!edit.enabled}
          aria-pressed={picking}
          title={
            picking
              ? "Click a color in the viewer (Escape stops)"
              : "Pick from the picture: click a color in the viewer to choose its family"
          }
          onClick={() => set({ picking: !picking })}
        >
          <Pipette className="size-3.5" /> {picking ? "Picking…" : "Pick"}
        </Button>
      </ToolColumn>
      <ToolColumn title={title(name)}>
        <div className="flex flex-col gap-1">
          {FIELDS.map(({ field, label }) => (
            <GradeSlider
              key={`${name}.${field}`}
              path={`mix.${name}.${field}`}
              label={label}
              step={1}
              value={mix[name][field]}
              resetTo={0}
              edit={edit}
              patch={(value) => patch(withFamily(mix, name, field, value))}
            />
          ))}
          <div className="h-1.5" />
          <GradeSlider
            path="mix.range"
            label="Range"
            step={1}
            value={mix.range}
            resetTo={0}
            edit={edit}
            patch={(range) => patch({ ...mix, range })}
          />
        </div>
      </ToolColumn>
      <ToolColumn title="All families · saturation">
        <div className="flex h-24 items-end gap-1.5 rounded-sm bg-background p-1.5">
          {MIX_FAMILIES.map((family) => (
            <i
              key={family}
              title={`${title(family)}: ${mix[family].sat}`}
              className="block flex-1 rounded-t-xs opacity-85"
              style={{ background: swatch(family), height: `${50 + mix[family].sat / 2}%` }}
            />
          ))}
        </div>
      </ToolColumn>
    </ToolColumns>
  );
}
