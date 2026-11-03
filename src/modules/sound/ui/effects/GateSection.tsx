import { useRef } from "react";
import type { GateEffect, SoundEffect } from "@/modules/project";
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
    range: { min: number; max: number; step: number; unit?: string; scale?: "log" },
  ) => (
    <EffectRow
      label={label}
      value={effect[key]}
      rest={REST[key]}
      {...range}
      disabled={!effect.on}
      edit={edit}
      write={(value) => ({ effect: { ...effect, [key]: value }, patch: { [key]: value } })}
      onLive={(next: SoundEffect) => graph.current?.draw(next as GateEffect)}
    />
  );
  return (
    <EffectSection effect={effect} edit={edit}>
      <TransferGraph effect={effect} ref={graph} />
      {row("thresholdDb", "Threshold", { min: -80, max: 0, step: 0.5, unit: "dB" })}
      {row("ratio", "Ratio", { min: 1, max: 20, step: 0.1, unit: ":1" })}
      {row("attackMs", "Attack", { min: 0.01, max: 2000, step: 0.01, unit: "ms", scale: "log" })}
      {row("releaseMs", "Release", { min: 0.01, max: 9000, step: 0.01, unit: "ms", scale: "log" })}
    </EffectSection>
  );
}
