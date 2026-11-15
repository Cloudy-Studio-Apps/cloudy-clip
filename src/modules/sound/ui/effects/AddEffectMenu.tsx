import { useState, type ReactElement } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { projectRef, type CompositionId, type SoundEffect } from "@/modules/project";
import { MenuList, Popover } from "@/ui";
import { addableKinds, chainWhere, EFFECT_NAMES } from "../../logic/effects";
import { addEffect } from "../../sound.effects.commands";
import type { MixTarget } from "../../sound.line.types";
import { report } from "../report";

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
  const group = useStore(useModule(projectRef).store.api, (s) =>
    Boolean(
      compositionId && s.compositions[compositionId]?.mix?.buses?.some((bus) => bus.id === target),
    ),
  );
  const kinds = addableKinds(chain, target, group);
  if (kinds.length === 0) return null;
  const items = kinds.map((kind) => ({
    label: EFFECT_NAMES[kind].name,
    onSelect: () =>
      void bus.run(addEffect, { ...chainWhere(target, compositionId), kind }).then(report),
  }));
  return (
    <Popover trigger={trigger} open={open} onOpenChange={setOpen}>
      <MenuList items={items} onClose={() => setOpen(false)} />
    </Popover>
  );
}
