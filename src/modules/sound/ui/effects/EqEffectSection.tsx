import { EqEditor } from "@/modules/audio";
import type { EqEffect } from "@/modules/project";
import type { EffectEdit } from "../../sound.types";
import { EffectSection } from "./EffectSection";

interface EqEffectSectionProps {
  effect: EqEffect;
  edit: EffectEdit;
}

/** The EQ effect: the same editor as a clip's Equalizer, on the chain's six bands. */
export function EqEffectSection({ effect, edit }: EqEffectSectionProps) {
  return (
    <EffectSection effect={effect} edit={edit} className="row-span-2" selfDims>
      <EqEditor
        eq={effect}
        onInput={({ bands }) => edit.live({ ...effect, bands })}
        onCommit={({ bands }) => void edit.commit(effect.id, { bands })}
      />
    </EffectSection>
  );
}
