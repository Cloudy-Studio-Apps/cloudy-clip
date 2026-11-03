import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, useOpenComposition } from "@/modules/project";
import { soundRef } from "../../sound.ref";

/**
 * Whose the panel is, at the right of its tabs: the marked strip's code and name (`A1 Voice 1`,
 * its place among the open composition's audio tracks, as the mixer counts), `Master`, or nothing.
 */
export function PanelWho() {
  const sound = useModule(soundRef);
  const open = useOpenComposition();
  const selected = useStore(sound.view, (s) => s.selected);
  const who = useStore(useModule(projectRef).store.api, (s) => {
    if (!open) return null;
    if (selected === "master") return "Master";
    if (!selected) return null;
    const audio = open.trackOrder.filter((id) => s.tracks[id]?.kind === "audio");
    const index = audio.indexOf(selected);
    const track = s.tracks[selected];
    return index < 0 || !track ? null : `A${index + 1} ${track.name}`;
  });
  if (!who) return null;
  return (
    <span className="ml-auto truncate pl-3 font-mono text-base text-muted-foreground">{who}</span>
  );
}
