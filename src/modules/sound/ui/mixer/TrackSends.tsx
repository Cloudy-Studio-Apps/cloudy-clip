import { Check, Plus } from "lucide-react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { projectRef, type MixBus, type Track } from "@/modules/project";
import type { MenuItem } from "@/ui";
import { addBus, sendTo } from "../../sound.bus.commands";
import { report } from "@/core";
import { SendsTo } from "./SendsTo";

const NO_GROUPS: readonly MixBus[] = [];

/** No icon: keeps the names in line with the checked one. */
const Blank = () => <span aria-hidden className="size-3.5 shrink-0" />;

/**
 * A track's "Sends to": Master or its group, a menu of Master and the composition's groups (one
 * `sound.sendTo`), and New group, which makes one (the first free `Group n`) with this track in it (one
 * `sound.addBus`).
 */
export function TrackSends({ track }: { track: Track }) {
  const { bus } = useKernel();
  const groups = useStore(
    useModule(projectRef).store.api,
    (s) => s.compositions[track.compositionId]?.mix?.buses ?? NO_GROUPS,
  );
  // A group the composition lacks sends to Master, as the mix does.
  const current = groups.find((group) => group.id === track.mix?.busId);
  const send = (busId: string | null) =>
    void bus.run(sendTo, { trackIds: [track.id], busId }).then(report);
  const items: MenuItem[] = [
    { label: "Master", icon: current ? Blank : Check, group: "to", onSelect: () => send(null) },
    ...groups.map((group) => ({
      label: group.name,
      group: "to",
      icon: group.id === current?.id ? Check : Blank,
      onSelect: () => send(group.id),
    })),
    {
      label: "New group",
      icon: Plus,
      group: "new",
      onSelect: () =>
        void bus
          .run(addBus, { compositionId: track.compositionId, trackIds: [track.id] })
          .then(report),
    },
  ];
  return <SendsTo to={current?.name ?? "Master"} items={items} />;
}
