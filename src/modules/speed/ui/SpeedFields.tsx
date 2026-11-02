import { DEFAULT_SPEED, sourceSpan, speedOf, type ClipId } from "@/modules/project";
import { SegmentedControl, SliderField, ToggleRow } from "@/ui";
import { useSpeedEdit } from "./speed.edit.hook";
import { TimecodeField } from "./TimecodeField";

const PRESETS = [0.25, 0.5, 1, 1.5, 2, 4];
const OPTIONS = PRESETS.map((rate) => ({ value: String(rate), label: `${rate}x` }));
const RED =
  "min-w-0 flex-1 data-[changed]:[&_input]:text-mark data-[changed]:[&_label]:border-mark";

/** The fields of a clip's speed, the same in the box and the inspector, so both always agree. */
export function SpeedFields({ clipId, bare }: { clipId: ClipId; bare?: boolean }) {
  const { clip, ripple, joined, live, commit, setRipple } = useSpeedEdit(clipId);
  if (!clip) return null;
  const { rate, pitchCorrection } = speedOf(clip);
  const changed = rate !== DEFAULT_SPEED.rate ? "" : undefined;
  const blocked = joined && !ripple;
  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <div data-changed={changed} className={RED}>
        <SliderField
          label="Speed"
          value={rate}
          min={0.1}
          max={10}
          step={0.01}
          unit="x"
          scale="log"
          bare={bare}
          disabled={blocked}
          onInput={live}
          onCommit={(next) => void commit({ rate: next })}
        />
      </div>
      <SegmentedControl
        label="Speed presets"
        options={OPTIONS}
        value={String(rate)}
        disabled={blocked}
        className="justify-between"
        onChange={(next) => void commit({ rate: Number(next) })}
      />
      <div className="flex min-w-0 items-center gap-2">
        <span className="w-[74px] shrink-0 text-base text-muted-foreground">Duration</span>
        <div data-changed={changed} className={RED}>
          <TimecodeField
            label="Duration"
            value={clip.duration}
            disabled={blocked || sourceSpan(clip) === 0}
            onCommit={(duration) => void commit({ duration })}
          />
        </div>
      </div>
      <ToggleRow label="Ripple timeline" checked={ripple} onChange={setRipple} />
      {blocked && (
        <p className="text-xs text-muted-foreground">
          This clip has a transition on its end. Turn Ripple timeline on to change its speed.
        </p>
      )}
      <ToggleRow
        label="Pitch correction"
        checked={pitchCorrection}
        onChange={(next) => void commit({ pitchCorrection: next })}
      />
    </div>
  );
}
