import { Plus } from "lucide-react";
import { useState } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import type { CompositionId, SoundEffect } from "@/modules/project";
import { Button, Popover, SelectField } from "@/ui";
import { BUILT_IN_PRESETS } from "../logic/presets";
import { applyPreset } from "../sound.effects.commands";
import { soundRef } from "../sound.ref";
import type { MixTarget } from "../sound.types";
import { AddEffectMenu } from "./AddEffectMenu";
import { PanelCard } from "./PanelCard";
import { SavePresetForm } from "./SavePresetForm";

interface PresetCardProps {
  /** The strip's name: a track's, or Master. */
  title: string;
  target: MixTarget;
  compositionId: CompositionId | undefined;
  chain: readonly SoundEffect[];
}

/**
 * The head of the Channel tab: apply a preset (the built-in ones, then the user's), keep the
 * chain as a preset of one's own, and add an effect.
 */
export function PresetCard({ title, target, compositionId, chain }: PresetCardProps) {
  const { bus } = useKernel();
  const own = useStore(useModule(soundRef).presets, (s) => s.presets);
  const [saving, setSaving] = useState(false);
  const options = [
    { value: "", label: "Apply a preset…" },
    ...BUILT_IN_PRESETS.map(({ id, name }) => ({ value: id, label: name })),
    ...own.map(({ id, name }) => ({ value: id, label: `${name} (yours)` })),
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
        <Popover
          open={saving}
          onOpenChange={setSaving}
          trigger={
            <Button size="sm" disabled={chain.length === 0}>
              Save as preset
            </Button>
          }
        >
          <SavePresetForm
            target={target}
            compositionId={compositionId}
            onSaved={() => setSaving(false)}
          />
        </Popover>
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
