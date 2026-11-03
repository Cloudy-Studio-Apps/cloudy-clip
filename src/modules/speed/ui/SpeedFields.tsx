import { useClipAtPlayhead } from "@/modules/inspector";
import { KeyAction } from "@/modules/keyframe";
import {
  DEFAULT_SPEED,
  RAMP_PATH,
  rampOf,
  sourceSpan,
  speedOf,
  type Clip,
  type ClipId,
} from "@/modules/project";
import { SegmentedControl, SliderField, ToggleRow } from "@/ui";
import { useSpeedEdit } from "./speed.edit.hook";
import { TimecodeField } from "./TimecodeField";

const PRESETS = [0.25, 0.5, 1, 1.5, 2, 4];
const OPTIONS = PRESETS.map((rate) => ({ value: String(rate), label: `${rate}x` }));
const RED =
  "min-w-0 flex-1 data-[changed]:[&_input]:text-mark data-[changed]:[&_label]:border-mark";

/** What the fields read and do, from `useSpeedEdit`, on a clip that exists. */
interface FieldsProps {
  clip: Clip;
  edit: ReturnType<typeof useSpeedEdit>;
  bare?: boolean;
}

function Fields({ clip, edit, bare }: FieldsProps) {
  const { ripple, joined, refused, live, commit, commitKey, setRipple } = edit;
  const { pitchCorrection, reversed } = speedOf(clip);
  const ramped = rampOf(clip) !== undefined;
  const shown = speedOf(useClipAtPlayhead(clip)).rate;
  const rate = ramped ? Math.round(shown * 100) / 100 : shown;
  const changed = rate !== DEFAULT_SPEED.rate ? "" : undefined;
  const blocked = joined && !ripple;
  const locked = blocked || ramped;
  // On a ramp, the slider and presets write a key at the playhead instead of one rate.
  const setRate = (next: number) => void (ramped ? commitKey(next) : commit({ rate: next }));
  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <div data-field-row className="flex min-w-0 items-center gap-1">
        <div data-changed={changed} className={RED}>
          <SliderField
            key={refused}
            label="Speed"
            value={rate}
            min={0.1}
            max={10}
            step={0.01}
            unit="x"
            scale="log"
            bare={bare}
            disabled={blocked}
            onInput={ramped ? () => undefined : live}
            onCommit={setRate}
          />
        </div>
        <KeyAction clip={clip} paths={[RAMP_PATH]} disabled={blocked || reversed} />
      </div>
      <SegmentedControl
        label="Speed presets"
        options={OPTIONS}
        value={String(rate)}
        disabled={blocked}
        className="justify-between"
        onChange={(next) => setRate(Number(next))}
      />
      <div className="flex min-w-0 items-center gap-2">
        <span className="w-[74px] shrink-0 text-base text-muted-foreground">Duration</span>
        <div data-changed={changed} className={RED}>
          <TimecodeField
            label="Duration"
            value={clip.duration}
            disabled={locked || sourceSpan(clip) === 0}
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
      {ramped && (
        <p className="text-xs text-muted-foreground">
          This clip has a speed ramp. Speed sets a key at the playhead; clear the keys to set one
          speed.
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

/** The fields of a clip's speed, the same in the box and the inspector, so both always agree. */
export function SpeedFields({ clipId, bare }: { clipId: ClipId; bare?: boolean }) {
  const edit = useSpeedEdit(clipId);
  return edit.clip ? <Fields clip={edit.clip} edit={edit} bare={bare} /> : null;
}
