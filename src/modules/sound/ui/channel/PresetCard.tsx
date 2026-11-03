import { Plus } from "lucide-react";
import { useState } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import type { CompositionId, SoundEffect } from "@/modules/project";
import { Button, Popover, SelectField } from "@/ui";
import { chainWhere } from "../../logic/effects";
import { BUILT_IN_PRESETS } from "../../logic/presets";
import { applyPreset } from "../../sound.effects.commands";
import { soundRef } from "../../sound.ref";
import type { MixTarget, SoundPreset } from "../../sound.types";
import { AddEffectMenu } from "../effects";
import { PanelCard } from "../card";
import { PresetOthers } from "./PresetOthers";
import { SavePresetForm } from "./SavePresetForm";

interface PresetCardProps {
  target: MixTarget;
  compositionId: CompositionId | undefined;
  chain: readonly SoundEffect[];
}

/**
 * The head of the Channel tab, "Preset": Sound, a picker that applies one (the built-in ones,
 * then the user's); Others, the same presets as links; Save as preset, the chain kept as one of
 * the user's own; and `+ Effect`. Each preset is one `sound.applyPreset`.
 */
export function PresetCard({ target, compositionId, chain }: PresetCardProps) {
  const { bus } = useKernel();
  const own = useStore(useModule(soundRef).presets, (s) => s.presets);
  const [saving, setSaving] = useState(false);
  // The master can't duck, so a preset with ducking isn't offered there.
  const fits = (preset: SoundPreset) =>
    target !== "master" || !preset.effects.some((effect) => effect.kind === "duck");
  const builtIn = BUILT_IN_PRESETS.filter(fits);
  const ownFitting = own.filter(fits);
  const options = [
    { value: "", label: "Apply a preset…" },
    ...builtIn.map(({ id, name }) => ({ value: id, label: name })),
    ...ownFitting.map(({ id, name }) => ({ value: id, label: `${name} (yours)` })),
  ];
  const where = chainWhere(target, compositionId);
  const apply = (presetId: string) => void bus.run(applyPreset, { ...where, presetId });

  return (
    <PanelCard title="Preset" className="row-span-2 flex flex-col">
      <div className="flex min-h-[25px] items-center justify-between gap-2 text-muted-foreground">
        <span>Sound</span>
        <SelectField
          label="Preset"
          value=""
          options={options}
          className="w-0 flex-1"
          onChange={(presetId) => {
            if (presetId) apply(presetId);
          }}
        />
      </div>
      <PresetOthers builtIn={builtIn} own={ownFitting} onApply={apply} />
      <div className="mt-2 flex flex-col gap-1.5">
        <Popover
          open={saving}
          onOpenChange={setSaving}
          trigger={
            <Button size="sm" className="w-full" disabled={chain.length === 0}>
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
        {/* In a row, so its trigger isn't stretched to the card's width. */}
        <div className="flex">
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
      </div>
    </PanelCard>
  );
}
