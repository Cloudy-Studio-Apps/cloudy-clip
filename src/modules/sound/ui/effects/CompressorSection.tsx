import { useRef } from "react";
import {
  EFFECT_RANGES,
  type CompressorEffect,
  type CompressorParams,
  type SoundEffect,
} from "@/modules/project";
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
    options: { step: number; unit?: string; scale?: "log" },
  ) => (
    <EffectRow
      label={label}
      value={effect.params[key]}
      rest={REST[key]}
      {...EFFECT_RANGES.compressor[key]}
      {...options}
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
      {row("thresholdDb", "Threshold", { step: 0.5, unit: "dB" })}
      {row("ratio", "Ratio", { step: 0.1, unit: ":1" })}
      {row("kneeDb", "Knee", { step: 0.5, unit: "dB" })}
      {row("attackMs", "Attack", { step: 0.01, unit: "ms", scale: "log" })}
      {row("releaseMs", "Release", { step: 0.01, unit: "ms", scale: "log" })}
      {row("makeupDb", "Makeup", { step: 0.5, unit: "dB" })}
    </EffectSection>
  );
}
