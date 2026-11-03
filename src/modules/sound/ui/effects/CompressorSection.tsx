import { useRef } from "react";
import type { CompressorEffect, CompressorParams, SoundEffect } from "@/modules/project";
import { defaultSpec } from "../../logic/effects";
import type { EffectEdit, TransferGraphHandle } from "../../sound.types";
import { EffectRow } from "./EffectRow";
import { EffectSection } from "./EffectSection";
import { TransferGraph } from "./TransferGraph";

const REST = (defaultSpec("compressor") as Omit<CompressorEffect, "id">).params;

interface CompressorSectionProps {
  effect: CompressorEffect;
  edit: EffectEdit;
}

/** The compressor: its transfer graph and six values. */
export function CompressorSection({ effect, edit }: CompressorSectionProps) {
  const graph = useRef<TransferGraphHandle>(null);
  const row = (
    key: keyof CompressorParams,
    label: string,
    range: { min: number; max: number; step: number; unit?: string; scale?: "log" },
  ) => (
    <EffectRow
      label={label}
      value={effect.params[key]}
      rest={REST[key]}
      {...range}
      disabled={!effect.on}
      edit={edit}
      write={(value) => ({
        effect: { ...effect, params: { ...effect.params, [key]: value } },
        patch: { params: { [key]: value } },
      })}
      onLive={(next: SoundEffect) => graph.current?.draw(next as CompressorEffect)}
    />
  );
  return (
    <EffectSection effect={effect} edit={edit}>
      <TransferGraph effect={effect} ref={graph} />
      {row("thresholdDb", "Threshold", { min: -60, max: 0, step: 0.5, unit: "dB" })}
      {row("ratio", "Ratio", { min: 1, max: 20, step: 0.1, unit: ":1" })}
      {row("kneeDb", "Knee", { min: 0, max: 18, step: 0.5, unit: "dB" })}
      {row("attackMs", "Attack", { min: 0.01, max: 2000, step: 0.01, unit: "ms", scale: "log" })}
      {row("releaseMs", "Release", { min: 0.01, max: 9000, step: 0.01, unit: "ms", scale: "log" })}
      {row("makeupDb", "Makeup", { min: 0, max: 36, step: 0.5, unit: "dB" })}
    </EffectSection>
  );
}
