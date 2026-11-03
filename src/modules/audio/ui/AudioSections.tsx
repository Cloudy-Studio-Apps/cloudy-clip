import { microsToSeconds, secondsToMicros } from "@/core";
import { InspectorSection, soundMember, type InspectorContext } from "@/modules/inspector";
import { DEFAULT_SOUND } from "@/modules/project";
import { Switch } from "@/ui";
import { useSoundEdit } from "./sound.edit.hook";
import { SoundRow } from "./SoundRow";

const MAX_FADE_SECONDS = 10;

const panSide = (pan: number) => (pan === 0 ? "C" : pan < 0 ? "L" : "R");

/** Volume of the clip, in dB. */
export function VolumeSection({ context }: { context: InspectorContext }) {
  const { sound, animated, live, commit, reset } = useSoundEdit(context);
  const clip = soundMember(context)?.clip;
  if (!sound || !clip) return null;
  return (
    <SoundRow
      label="Volume"
      keys={{ clip, path: "sound.volumeDb", animated: animated("volumeDb") }}
      value={sound.volumeDb}
      min={-60}
      max={12}
      step={0.5}
      unit="dB"
      rest={DEFAULT_SOUND.volumeDb}
      onInput={(volumeDb) => live({ volumeDb })}
      onCommit={(volumeDb) => void commit({ volumeDb })}
      onReset={() => reset("volume")}
    />
  );
}

/** Where the sound sits, left to right. */
export function PanSection({ context }: { context: InspectorContext }) {
  const { sound, animated, live, commit, reset } = useSoundEdit(context);
  const clip = soundMember(context)?.clip;
  if (!sound || !clip) return null;
  return (
    <SoundRow
      label="Pan"
      keys={{ clip, path: "sound.pan", animated: animated("pan") }}
      value={Math.round(sound.pan * 100)}
      min={-100}
      max={100}
      step={1}
      unit={panSide(sound.pan)}
      rest={0}
      onInput={(value) => live({ pan: value / 100 })}
      onCommit={(value) => void commit({ pan: value / 100 })}
      onReset={() => reset("pan")}
    />
  );
}

/** How the clip comes in and goes out. */
export function FadesSection({ context }: { context: InspectorContext }) {
  const { sound, live, commit } = useSoundEdit(context);
  if (!sound) return null;
  const row = (label: string, key: "fadeIn" | "fadeOut") => (
    <SoundRow
      label={label}
      value={microsToSeconds(sound[key])}
      min={0}
      max={MAX_FADE_SECONDS}
      step={0.1}
      unit="s"
      rest={0}
      onInput={(value) => live({ [key]: secondsToMicros(value) })}
      onCommit={(value) => void commit({ [key]: secondsToMicros(value) })}
      onReset={() => void commit({ [key]: 0 })}
    />
  );
  return (
    <>
      {row("Fade in", "fadeIn")}
      {row("Fade out", "fadeOut")}
    </>
  );
}

/** Moves the sound up or down without changing its length. */
export function PitchSection({ context }: { context: InspectorContext }) {
  const { sound, live, commit } = useSoundEdit(context);
  if (!sound) return null;
  const { pitch } = sound;
  const row = (label: string, key: "semitones" | "cents", span: number) => (
    <SoundRow
      label={label}
      value={pitch[key]}
      min={-span}
      max={span}
      step={1}
      rest={0}
      disabled={!pitch.on}
      onInput={(value) => live({ pitch: { ...pitch, [key]: value } })}
      onCommit={(value) => void commit({ pitch: { ...pitch, [key]: value } })}
      onReset={() => void commit({ pitch: { ...pitch, [key]: 0 } })}
    />
  );
  return (
    <InspectorSection
      title="Pitch"
      foldKey="audio.pitch"
      leading={
        <Switch
          label="Pitch"
          checked={pitch.on}
          onChange={(on) => void commit({ pitch: { ...pitch, on } })}
        />
      }
    >
      {row("Semitones", "semitones", 24)}
      {row("Cents", "cents", 100)}
    </InspectorSection>
  );
}
