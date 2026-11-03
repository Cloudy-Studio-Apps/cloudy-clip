import type { LimiterEffect } from "@/modules/project";
import { defaultSpec } from "../../logic/effects";
import type { EffectEdit } from "../../sound.types";
import { EffectRow } from "./EffectRow";
import { EffectSection } from "./EffectSection";

const REST = defaultSpec("limiter") as Omit<LimiterEffect, "id">;

interface LimiterSectionProps {
  effect: LimiterEffect;
  edit: EffectEdit;
}

/** The limiter: the ceiling nothing goes over, and how fast it lets go. */
export function LimiterSection({ effect, edit }: LimiterSectionProps) {
  return (
    <EffectSection effect={effect} edit={edit}>
      <EffectRow
        label="Ceiling"
        value={effect.ceilingDb}
        rest={REST.ceilingDb}
        min={-20}
        max={0}
        step={0.1}
        unit="dB"
        disabled={!effect.on}
        edit={edit}
        write={(ceilingDb) => ({ effect: { ...effect, ceilingDb }, patch: { ceilingDb } })}
      />
      <EffectRow
        label="Release"
        value={effect.releaseMs}
        rest={REST.releaseMs}
        min={1}
        max={8000}
        step={1}
        unit="ms"
        scale="log"
        disabled={!effect.on}
        edit={edit}
        write={(releaseMs) => ({ effect: { ...effect, releaseMs }, patch: { releaseMs } })}
      />
    </EffectSection>
  );
}
