import { Columns2 } from "lucide-react";
import { useState } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, type Clip, type ProjectState } from "@/modules/project";
import { IconButton, MenuList, Popover, type MenuItem } from "@/ui";
import { landingTime } from "../logic/strip";
import { tintRef } from "../tint.ref";
import { useStrip } from "./strip.hook";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

const nameOf = (state: ProjectState, clip: Clip) =>
  (clip.compositionRef && state.compositions[clip.compositionRef]?.name) ||
  (clip.mediaId && state.media[clip.mediaId]?.name) ||
  "Clip";

/** The viewer's side by side button: opens a menu of stills and the other clips to show beside the picture. */
export function SideMenu() {
  const tint = useModule(tintRef);
  const project = useModule(projectRef);
  const set = useTintSet();
  const [open, setOpen] = useState(false);
  const side = useTintView((v) => v.side);
  const state = useStore(project.store.api, (s) => s);
  const current = useStore(tint.view, (v) => v.pinned);
  const strip = useStrip();
  const items: MenuItem[] = [
    ...(side ? [{ label: "Off", onSelect: () => set({ side: null }), group: "off" }] : []),
    ...(state.stillOrder ?? []).flatMap((id) => {
      const still = state.stills?.[id];
      return still
        ? [
            {
              label: `Still: ${still.name}`,
              onSelect: () => set({ side: { kind: "still", stillId: id } }),
              group: "stills",
            },
          ]
        : [];
    }),
    ...strip
      .filter((entry) => entry.clip.id !== (current ?? tint.current()))
      .map((entry) => ({
        label: `${entry.no} ${nameOf(state, entry.clip)}`,
        onSelect: () =>
          set({
            side: {
              kind: "clip",
              clipId: entry.clip.id,
              time: landingTime(entry.clip, tint.viewedAt(entry.clip.id)),
            },
          }),
        group: "clips",
      })),
  ];
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <IconButton
          label="Side by side: a still or another clip's frame beside this picture"
          active={side !== null}
        >
          <Columns2 />
        </IconButton>
      }
    >
      {items.length ? (
        <MenuList items={items} onClose={() => setOpen(false)} />
      ) : (
        <p className="px-3 py-2 text-xs text-muted-foreground">No other clip or still yet.</p>
      )}
    </Popover>
  );
}
