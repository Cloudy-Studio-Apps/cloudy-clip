import { formatDb, soundOf, type Clip } from "@/modules/project";

/**
 * A clip's gain at its top right ("+2.0 dB") on the Sound timeline, in red pencil: shown while its
 * volume reads other than 0.0 dB and has no keys (a keyed volume changes along the clip). It steps
 * aside while the clip is selected or hovered, when the fade handle and keyframe's toggle use that
 * corner.
 */
export function GainBadge({ clip, selected }: { clip: Clip; selected: boolean }) {
  const gain = formatDb(soundOf(clip).volumeDb);
  if (selected || gain === formatDb(0) || clip.animation?.["sound.volumeDb"] !== undefined) {
    return null;
  }
  return (
    <span className="absolute right-1 top-px bg-surface px-[3px] font-mono text-xs font-bold text-mark group-hover:hidden">
      {gain} dB
    </span>
  );
}
