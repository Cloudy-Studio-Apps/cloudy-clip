import { memo, useEffect, useRef } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { projectRef, trackMixOf, type Track } from "@/modules/project";
import { setTrackMuted } from "@/modules/timeline";
import { cn } from "@/ui";
import { chainOf, placesUnheardEffects } from "../logic/effects";
import { setTrackMix } from "../sound.mix.commands";
import { setSolo } from "../sound.monitor.commands";
import { soundRef } from "../sound.ref";
import { ArmButton } from "./ArmButton";
import { EffectChain } from "./EffectChain";
import { Fader } from "./Fader";
import { Meter } from "./Meter";
import { PanSlider } from "./PanSlider";
import { StripLabel } from "./StripLabel";
import { StripToggle } from "./StripToggle";

interface MixerStripProps {
  track: Track;
  /** `A1`, `A2`… by its place among the audio tracks. */
  code: string;
  selected: boolean;
  soloed: boolean;
}

/**
 * One audio track in the mixer: name, its effects, where it goes, pan, fader with its two meters
 * (the microphone's while a take is recorded onto it), mute, solo and record-arm. A click marks
 * the track (and its header on the timeline) and shows its chain in the Channel tab; when marked,
 * it scrolls into view.
 */
export const MixerStrip = memo(function MixerStrip({
  track,
  code,
  selected,
  soloed,
}: MixerStripProps) {
  const { bus } = useKernel();
  const preview = useModule(previewRef);
  const project = useModule(projectRef).store;
  const sound = useModule(soundRef);
  const ref = useRef<HTMLDivElement>(null);
  const unheard = useStore(project.api, (s) => placesUnheardEffects(s, track.id));
  const effects = useStore(project.api, (s) => chainOf(s, track.id, track.compositionId));
  // While a take is recorded onto this track, its meters show the microphone.
  const recording = useStore(
    sound.recorder.state,
    (s) => s.status === "recording" && s.trackId === track.id,
  );
  const metered = recording ? "input" : track.id;

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selected]);

  const read = () => {
    const current = project.getState().tracks[track.id];
    return current ? trackMixOf(current).volumeDb : 0;
  };

  return (
    <div
      ref={ref}
      className={cn(
        "flex w-24 shrink-0 cursor-pointer flex-col gap-1.5 border-r border-dashed border-border-strong p-2",
        selected && "shadow-[inset_0_2px_0_var(--mark)]",
      )}
      onClick={() => sound.select(track.id)}
    >
      <div className="truncate text-center font-hand text-base font-bold leading-tight">
        {track.name}
      </div>
      <div className="-mt-1 text-center font-mono text-sm font-bold text-subtle-foreground">
        {code}
      </div>
      <StripLabel>Effects</StripLabel>
      <EffectChain target={track.id} compositionId={track.compositionId} effects={effects} />
      {unheard && (
        <span
          className="-mt-1 truncate text-2xs text-subtle-foreground"
          title="A composition placed here has effects of its own. They aren't heard from outside: only its clips' sound is."
        >
          Inner effects not heard
        </span>
      )}
      <StripLabel>Sends to</StripLabel>
      <div className="truncate border-b border-border-strong font-mono text-sm text-muted-foreground">
        Master
      </div>
      <StripLabel>Pan</StripLabel>
      <PanSlider track={track} />
      <Fader
        value={trackMixOf(track).volumeDb}
        label={`${track.name} level`}
        onInput={(db) => preview.sound.previewMix(track.id, db === null ? null : { volumeDb: db })}
        onCommit={async (volumeDb) =>
          void (await bus.run(setTrackMix, { trackId: track.id, volumeDb }))
        }
        read={read}
      >
        <Meter target={metered} side="left" />
        <Meter target={metered} side="right" />
      </Fader>
      <div className="flex justify-center gap-0.5">
        <StripToggle
          on={track.muted}
          label={track.muted ? "Unmute track" : "Mute track"}
          tone="mark"
          onToggle={() => void bus.run(setTrackMuted, { trackId: track.id, muted: !track.muted })}
        >
          M
        </StripToggle>
        <StripToggle
          on={soloed}
          label={soloed ? "Stop soloing" : "Solo track"}
          tone="ink"
          onToggle={() => void bus.run(setSolo, { trackId: track.id, on: !soloed })}
        >
          S
        </StripToggle>
        <ArmButton track={track} />
      </div>
    </div>
  );
});
