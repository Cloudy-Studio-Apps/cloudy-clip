import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { SoundEffect } from "@/modules/project";
import { cn, IconButton, Switch } from "@/ui";
import { EFFECT_NAMES } from "../../logic/effects";
import type { EffectEdit } from "../../sound.types";
import { PanelCard } from "../card";

interface EffectSectionProps {
  effect: SoundEffect;
  edit: EffectEdit;
  /** `row-span-2` for a tall card (EQ, Compressor). */
  className?: string;
  /** Its body dims itself while off (the EQ's graph), so the card doesn't dim it again. */
  selfDims?: boolean;
  children: ReactNode;
}

/**
 * One effect of the chain as a card of the Channel tab: its name, a button that takes it out
 * (shown on hover and focus, always on a touch screen), its switch at the right, and its values,
 * at 40 % while it's off.
 */
export function EffectSection({ effect, edit, className, selfDims, children }: EffectSectionProps) {
  const { name } = EFFECT_NAMES[effect.kind];
  return (
    <PanelCard
      title={name}
      dim={!effect.on && !selfDims}
      className={cn("group/effect", className)}
      actions={
        <span className="flex shrink-0 items-center gap-1.5">
          <IconButton
            label={`Remove ${name.toLowerCase()}`}
            className="!size-[22px] opacity-0 focus-visible:opacity-100 group-hover/effect:opacity-100 pointer-coarse:opacity-100 [&_svg]:!size-3.5"
            onClick={() => edit.remove(effect.id)}
          >
            <X />
          </IconButton>
          <Switch
            label={name}
            checked={effect.on}
            onChange={(on) => void edit.commit(effect.id, { on })}
          />
        </span>
      }
    >
      <div className="flex flex-col gap-1.5">{children}</div>
    </PanelCard>
  );
}
