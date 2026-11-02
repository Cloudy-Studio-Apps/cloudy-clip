import { useMemo } from "react";
import { usePoint } from "@/core";
import { orderCategories } from "../logic/categories";
import { transitionPresets } from "../transition.points";
import { PresetTile } from "./PresetTile";

/**
 * The Transitions tab: every preset by category. A click applies it to the selected cut (or the
 * cut after the selected clip); a drag drops it on a cut of the timeline.
 */
export function TransitionsPanel() {
  const presets = usePoint(transitionPresets);
  const sections = useMemo(() => orderCategories(presets), [presets]);
  return (
    <section className="flex h-full flex-col gap-2.5 overflow-y-auto overflow-x-hidden p-2.5">
      <h2 className="font-hand text-[13px] font-bold text-foreground">Transitions</h2>
      {sections.map((section) => (
        <div key={section.category} className="flex flex-col gap-1.5">
          <h3 className="font-hand text-[13px] font-bold text-foreground">{section.title}</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {section.presets.map((preset) => (
              <PresetTile key={preset.id} preset={preset} />
            ))}
          </div>
        </div>
      ))}
      <p className="text-2xs text-muted-foreground">
        Select a cut or a clip and click, or drag a transition onto a cut on the timeline.
      </p>
    </section>
  );
}
