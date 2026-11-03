import { X } from "lucide-react";
import type { ReactNode } from "react";
import { InspectorSection } from "@/modules/inspector";
import type { SoundEffect } from "@/modules/project";
import { IconButton, Switch } from "@/ui";
import { EFFECT_NAMES } from "../../logic/effects";
import type { EffectEdit } from "../../sound.types";

interface EffectSectionProps {
  effect: SoundEffect;
  edit: EffectEdit;
  children: ReactNode;
}

/**
 * One effect of the chain as a section of the Channel tab: its switch, its name (a click folds
 * it, as in the inspector), a button that takes it out, and its values.
 */
export function EffectSection({ effect, edit, children }: EffectSectionProps) {
  const { name } = EFFECT_NAMES[effect.kind];
  return (
    <InspectorSection
      title={name}
      foldKey={`sound.effect.${effect.kind}`}
      leading={
        <Switch
          label={name}
          checked={effect.on}
          onChange={(on) => void edit.commit(effect.id, { on })}
        />
      }
      actions={
        <IconButton
          label={`Remove ${name.toLowerCase()}`}
          className="!size-[22px] [&_svg]:!size-3.5"
          onClick={() => edit.remove(effect.id)}
        >
          <X />
        </IconButton>
      }
    >
      {children}
    </InspectorSection>
  );
}
