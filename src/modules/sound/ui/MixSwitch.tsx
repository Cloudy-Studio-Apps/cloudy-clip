import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { compositionMixOf, projectRef, useOpenComposition } from "@/modules/project";
import { SegmentedControl, type SegmentedOption } from "@/ui";
import { switchMix } from "../sound.mix.commands";

const MIXES: readonly SegmentedOption<"a" | "b">[] = [
  { value: "a", label: "Mix A", hint: "Mix A: every track's level and pan, and the master" },
  { value: "b", label: "Mix B", hint: "Mix B: the first switch starts it as a copy of A" },
];

/** Mix A and Mix B of the open composition; the active one is underlined. One undo step a switch. */
export function MixSwitch() {
  const { bus } = useKernel();
  const open = useOpenComposition();
  const active = useStore(useModule(projectRef).store.api, (s) => {
    const composition = open && s.compositions[open.id];
    return composition ? compositionMixOf(composition).activeMix : undefined;
  });

  return (
    <SegmentedControl
      label="Mix"
      options={MIXES}
      value={active}
      disabled={!open}
      onChange={(to) => void bus.run(switchMix, { to })}
    />
  );
}
