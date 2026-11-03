import { useState, type ReactElement } from "react";
import { useKernel } from "@/core";
import type { CompositionId, SoundEffect } from "@/modules/project";
import { MenuList, Popover } from "@/ui";
import { addableKinds, chainWhere, EFFECT_NAMES } from "../../logic/effects";
import { addEffect } from "../../sound.effects.commands";
import type { MixTarget } from "../../sound.types";

interface AddEffectMenuProps {
  target: MixTarget;
  compositionId: CompositionId | undefined;
  chain: readonly SoundEffect[];
  /** What opens the menu: the strip's `+ Effect` row, or the Channel tab's button. */
  trigger: ReactElement;
}

/** The kinds a chain doesn't have yet; picking one adds it at its defaults, at the end. */
export function AddEffectMenu({ target, compositionId, chain, trigger }: AddEffectMenuProps) {
  const { bus } = useKernel();
  const [open, setOpen] = useState(false);
  const kinds = addableKinds(chain, target);
  if (kinds.length === 0) return null;
  const items = kinds.map((kind) => ({
    label: EFFECT_NAMES[kind].name,
    onSelect: () => void bus.run(addEffect, { ...chainWhere(target, compositionId), kind }),
  }));
  return (
    <Popover trigger={trigger} open={open} onOpenChange={setOpen}>
      <MenuList items={items} onClose={() => setOpen(false)} />
    </Popover>
  );
}
