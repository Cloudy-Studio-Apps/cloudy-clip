import { formatDb, soundOf, type Clip } from "@/modules/project";

/**
 * A clip's gain at its top right ("+2.0 dB") on the Sound timeline, in red pencil: shown while its
 * volume isn't 0 dB and has no keys (a keyed volume changes along the clip); nothing otherwise.
 */
export function GainBadge({ clip }: { clip: Clip; selected: boolean }) {
  const { volumeDb } = soundOf(clip);
  if (volumeDb === 0 || clip.animation?.["sound.volumeDb"] !== undefined) return null;
  return (
    <span className="absolute right-1 top-px bg-surface px-[3px] font-mono text-xs font-bold text-mark">
      {formatDb(volumeDb)} dB
    </span>
  );
}
