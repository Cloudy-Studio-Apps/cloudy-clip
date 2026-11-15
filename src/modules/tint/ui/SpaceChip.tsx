import { useStore } from "zustand";
import { useModule } from "@/core";
import { gradeOf, projectRef } from "@/modules/project";
import { SPACE_NAMES } from "./space.names";
import { useCurrentClip } from "./current.hook";

/** The current clip's input color space, shown as Rec.709; nothing for Rec.709 itself. */
export function SpaceChip() {
  const clipId = useCurrentClip();
  const input = useStore(useModule(projectRef).store.api, (s) => {
    const clip = clipId ? s.clips[clipId] : undefined;
    return (clip && gradeOf(clip)?.input) ?? "rec709";
  });
  if (input === "rec709") return null;
  const { name, short } = SPACE_NAMES[input];
  return (
    <span
      title={`Camera ${name}, shown as Rec.709`}
      className="rounded-xs bg-surface-sunken px-1.5 py-0.5 font-mono text-xs font-normal text-muted-foreground"
    >
      {short} → 709
    </span>
  );
}
