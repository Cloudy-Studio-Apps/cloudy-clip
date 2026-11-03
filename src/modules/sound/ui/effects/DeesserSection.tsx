import { EFFECT_RANGES, type DeesserEffect } from "@/modules/project";
import { defaultSpec } from "../../logic/effects";
import type { EffectEdit } from "../../sound.types";
import { EffectRow } from "./EffectRow";
import { EffectSection } from "./EffectSection";

const AMOUNT = EFFECT_RANGES.deesser.amount;
const REST = defaultSpec("deesser");

interface DeesserSectionProps {
  effect: DeesserEffect;
  edit: EffectEdit;
}

/** The de-esser: where sibilance sits, and how much of it goes (shown in percent). */
export function DeesserSection({ effect, edit }: DeesserSectionProps) {
  return (
    <EffectSection effect={effect} edit={edit}>
      <EffectRow
        label="Frequency"
        value={effect.frequencyHz}
        rest={REST.frequencyHz}
        {...EFFECT_RANGES.deesser.frequencyHz}
        step={50}
        unit="Hz"
        disabled={!effect.on}
        edit={edit}
        write={(frequencyHz) => ({
          effect: { ...effect, frequencyHz },
          patch: { frequencyHz },
        })}
      />
      <EffectRow
        label="Amount"
        value={Math.round(effect.amount * 100)}
        rest={Math.round(REST.amount * 100)}
        min={AMOUNT.min * 100}
        max={AMOUNT.max * 100}
        step={1}
        unit="%"
        disabled={!effect.on}
        edit={edit}
        write={(percent) => ({
          effect: { ...effect, amount: percent / 100 },
          patch: { amount: percent / 100 },
        })}
      />
    </EffectSection>
  );
}
