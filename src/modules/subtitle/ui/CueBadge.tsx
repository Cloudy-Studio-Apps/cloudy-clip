import { useStore } from "zustand";
import { useModule } from "@/core";
import { MARKER_HEX, projectRef, type Clip } from "@/modules/project";

/** Over a subtitle cue in the editor's timeline: "CC" in its style's color. */
export function CueBadge({ clip }: { clip: Clip; selected: boolean }) {
  const style = useStore(useModule(projectRef).store.api, (s) =>
    clip.subtitle ? s.subtitleStyles?.[clip.subtitle.styleId] : undefined,
  );
  if (!style) return null;
  return (
    <span
      title={`Subtitle · ${style.name}`}
      className="absolute bottom-1 right-1 rounded-xs bg-surface/80 px-1 font-mono text-2xs font-bold leading-4"
      style={{ color: MARKER_HEX[style.color] }}
    >
      CC
    </span>
  );
}
