import { useRef } from "react";
import { EFFECT_RANGES, type GateEffect, type SoundEffect } from "@/modules/project";
import { defaultSpec } from "../../logic/effects";
import type { EffectEdit, TransferGraphHandle } from "../../sound.types";
import { EffectRow } from "./EffectRow";
import { EffectSection } from "./EffectSection";
import { TransferGraph } from "./TransferGraph";

const REST = defaultSpec("gate") as Omit<GateEffect, "id">;

interface GateSectionProps {
  effect: GateEffect;
  edit: EffectEdit;
}

/** The noise gate: its transfer graph and four values. */
export function GateSection({ effect, edit }: GateSectionProps) {
  const graph = useRef<TransferGraphHandle>(null);
  const row = (
    key: "thresholdDb" | "ratio" | "attackMs" | "releaseMs",
    label: string,
    options: { step: number; unit?: string; scale?: "log" },
  ) => (
    <EffectRow
      label={label}
      value={effect[key]}
      rest={REST[key]}
      {...EFFECT_RANGES.gate[key]}
      {...options}
      disabled={!effect.on}
      edit={edit}
      write={(value) => ({ effect: { ...effect, [key]: value }, patch: { [key]: value } })}
      onLive={(next: SoundEffect) => graph.current?.draw(next as GateEffect)}
    />
  );
  return (
    <EffectSection effect={effect} edit={edit}>
      <TransferGraph effect={effect} ref={graph} />
      {row("thresholdDb", "Threshold", { step: 0.5, unit: "dB" })}
      {row("ratio", "Ratio", { step: 0.1, unit: ":1" })}
      {row("attackMs", "Attack", { step: 0.01, unit: "ms", scale: "log" })}
      {row("releaseMs", "Release", { step: 0.01, unit: "ms", scale: "log" })}
    </EffectSection>
  );
}
