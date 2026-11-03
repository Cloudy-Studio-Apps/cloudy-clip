import { Pipette } from "lucide-react";
import { Button, cn } from "@/ui";
import { DEMO_FAMILIES, DEMO_FAMILY_SAT } from "../demo/demo.values";
import type { DemoField } from "../demo/demo.types";
import { useTintView } from "../view.hook";
import { useTintSet } from "../view.set.hook";
import { DemoSliders } from "./DemoSliders";
import { ToolColumn } from "./ToolColumn";
import { ToolColumns } from "./ToolColumns";

const swatch = (hue: number) => `hsl(${hue} 70% 55%)`;

const FIELDS: readonly DemoField[] = [
  { label: "Hue", value: -6, min: -100, max: 100, step: 1 },
  { label: "Saturation", value: 12, min: -100, max: 100, step: 1 },
  { label: "Brightness", value: 4, min: -100, max: 100, step: 1 },
  { label: "Range", value: 0, min: -100, max: 100, step: 1 },
];

/** Color mix: pick a color family and change its hue, saturation and brightness. */
export function ColorMixTool() {
  const family = useTintView((v) => v.family);
  const set = useTintSet();
  const chosen = DEMO_FAMILIES[family] ?? DEMO_FAMILIES[0];
  return (
    <ToolColumns>
      <ToolColumn
        title="Color family"
        info="Change one color family without picking: greener grass, a calmer sky, warmer skin."
      >
        <div className="mb-4 flex gap-2.5">
          {DEMO_FAMILIES.map((f, i) => (
            <button
              key={f.name}
              type="button"
              title={f.name}
              aria-pressed={i === family}
              onClick={() => set({ family: i })}
              className={cn(
                "size-[22px] cursor-pointer rounded-full",
                i === family
                  ? "shadow-[0_0_0_2px_var(--surface),0_0_0_3.5px_var(--foreground)]"
                  : "shadow-[0_0_0_1px_var(--border-strong)]",
              )}
              style={{ background: swatch(f.hue) }}
            />
          ))}
        </div>
        <Button size="sm" title="Pick from the picture: click a color in the viewer">
          <Pipette className="size-3.5" /> Pick
        </Button>
      </ToolColumn>
      <ToolColumn title={chosen.name}>
        <DemoSliders fields={FIELDS} />
      </ToolColumn>
      <ToolColumn title="All families · saturation">
        <div className="flex h-24 items-end gap-1.5 rounded-sm bg-background p-1.5">
          {DEMO_FAMILIES.map((f, i) => (
            <i
              key={f.name}
              className="block flex-1 rounded-t-xs opacity-85"
              style={{ background: swatch(f.hue), height: `${(DEMO_FAMILY_SAT[i] ?? 0.5) * 100}%` }}
            />
          ))}
        </div>
      </ToolColumn>
    </ToolColumns>
  );
}
