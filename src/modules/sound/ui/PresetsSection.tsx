import { useStore } from "zustand";
import { useModule } from "@/core";
import { EmptyState } from "@/ui";
import { soundRef } from "../sound.ref";
import { PresetRow } from "./PresetRow";

/**
 * Settings › Sound presets: the user's own, renamed and removed here. They're kept on this
 * computer, outside any project; the built-in ones can't change.
 */
export function PresetsSection() {
  const presets = useStore(useModule(soundRef).presets, (s) => s.presets);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Your own presets, for any project on this computer. Applying one writes its values into the
        chain, so renaming or removing it here changes no project.
      </p>
      {presets.length === 0 ? (
        <EmptyState title="No presets of your own yet">
          On the Sound page, open the Channel tab of a strip and choose Save as preset.
        </EmptyState>
      ) : (
        <ul className="flex flex-col">
          {presets.map((preset) => (
            <PresetRow key={preset.id} preset={preset} />
          ))}
        </ul>
      )}
    </div>
  );
}
