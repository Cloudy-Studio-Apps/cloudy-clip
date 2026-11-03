import { Plus } from "lucide-react";
import { useKernel } from "@/core";
import type { CompositionId, SoundEffect } from "@/modules/project";
import { Button, SelectField } from "@/ui";
import { BUILT_IN_PRESETS } from "../logic/presets";
import { applyPreset } from "../sound.effects.commands";
import type { MixTarget } from "../sound.types";
import { AddEffectMenu } from "./AddEffectMenu";
import { PanelCard } from "./PanelCard";

interface PresetCardProps {
  /** The strip's name: a track's, or Master. */
  title: string;
  target: MixTarget;
  compositionId: CompositionId | undefined;
  chain: readonly SoundEffect[];
}

/** The head of the Channel tab: apply a built-in preset, and add an effect. */
export function PresetCard({ title, target, compositionId, chain }: PresetCardProps) {
  const { bus } = useKernel();
  const options = [
    { value: "", label: "Apply a preset…" },
    ...BUILT_IN_PRESETS.map(({ id, name }) => ({ value: id, label: name })),
  ];
  const where = { target, ...(target === "master" && compositionId && { compositionId }) };

  return (
    <PanelCard title={title} className="flex flex-col gap-2">
      <SelectField
        label="Preset"
        value=""
        options={options}
        onChange={(presetId) => {
          if (presetId) void bus.run(applyPreset, { ...where, presetId });
        }}
      />
      <span className="text-xs text-subtle-foreground">
        A preset replaces the whole chain with plain values; undo brings the old one back.
      </span>
      <div className="flex flex-wrap gap-1.5">
        <AddEffectMenu
          target={target}
          compositionId={compositionId}
          chain={chain}
          trigger={
            <Button size="sm">
              <Plus />
              Effect
            </Button>
          }
        />
      </div>
    </PanelCard>
  );
}
