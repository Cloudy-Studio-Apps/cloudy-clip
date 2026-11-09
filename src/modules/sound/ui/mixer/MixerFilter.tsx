import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import type { MixBus } from "@/modules/project";
import { SegmentedControl, type SegmentedOption } from "@/ui";
import { soundRef } from "../../sound.ref";

/** Every strip. A group id never reads like it (`createId("bus")`). */
const ALL = "all";

/**
 * Which strips the mixer shows: All, or one button per group of the open composition (that group
 * and the tracks sent to it; Master always shows). View state (`sound.setFilter`), never in the
 * document. A filter whose group goes shows All.
 */
export function MixerFilter({ groups }: { groups: readonly MixBus[] }) {
  const sound = useModule(soundRef);
  const filter = useStore(sound.view, (s) => s.filter);
  const options = useMemo(
    (): SegmentedOption<string>[] => [
      { value: ALL, label: "All", hint: "Every strip" },
      ...groups.map((group) => ({
        value: group.id,
        label: group.name,
        hint: `${group.name} and the tracks sent to it`,
      })),
    ],
    [groups],
  );
  const shown = groups.find((group) => group.id === filter)?.id ?? ALL;
  return (
    <SegmentedControl
      label="Show strips"
      className="min-w-0 shrink overflow-x-auto"
      options={options}
      value={shown}
      onChange={(value) => sound.setFilter(value === ALL ? null : value)}
    />
  );
}
