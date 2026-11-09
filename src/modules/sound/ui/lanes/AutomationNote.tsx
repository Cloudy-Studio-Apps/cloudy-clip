import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { modeName, nextMode } from "../../logic/automation";
import { soundRef } from "../../sound.ref";
import { cn } from "@/ui";

/**
 * "Automation: Touch" at the right of the timeline's tools: the automation mode of the marked
 * track; a click goes to the next (Read, Touch, Latch), as the strip's button does. "Automation —"
 * while no audio track is marked.
 */
export function AutomationNote() {
  const sound = useModule(soundRef);
  const selected = useStore(sound.view, (s) => s.selected);
  const trackId = useStore(useModule(projectRef).store.api, (s) =>
    selected !== null && selected !== "master" && s.tracks[selected]?.kind === "audio"
      ? selected
      : null,
  );
  const mode = useStore(sound.view, (s) =>
    trackId === null ? null : (s.automation[trackId] ?? "read"),
  );
  const className = "shrink-0 whitespace-nowrap px-1 font-mono text-sm text-muted-foreground";
  if (trackId === null || mode === null) {
    return (
      <span className={className} title="Mark a track to see and change its automation mode">
        Automation —
      </span>
    );
  }
  return (
    <button
      type="button"
      className={cn(className, "cursor-pointer hover:text-foreground")}
      title={`Click for ${modeName(nextMode(mode))}`}
      onClick={() => sound.setAutomation(trackId, nextMode(mode))}
    >
      Automation: {modeName(mode)}
    </button>
  );
}
