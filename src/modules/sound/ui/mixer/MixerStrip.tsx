import { memo, useCallback, useEffect, useRef } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import {
  projectRef,
  trackMixOf,
  type CompositionId,
  type MixBus,
  type Track,
} from "@/modules/project";
import { setTrackMuted } from "@/modules/timeline";
import { cn, ContextMenu, LetterToggle } from "@/ui";
import { clampDb, lineDb } from "../../logic/automation";
import { chainOf, placesUnheardEffects } from "../../logic/effects";
import type { HeardFeed } from "../../sound.types";
import { removeBus, setBus } from "../../sound.bus.commands";
import { soundRef } from "../../sound.ref";
import { SoloButton, useAutomationFader } from "../lanes";
import { EffectChain } from "../effects";
import { Fader } from "./Fader";
import { Meter } from "./Meter";
import { PanSlider } from "./PanSlider";
import { ReadButton } from "./ReadButton";
import { SendsTo } from "./SendsTo";
import { StripLabel } from "./StripLabel";
import { StripName } from "./StripName";
import { TrackSends } from "./TrackSends";

/** `A1`, `A2`… for a track by its place among the audio tracks; `G1`, `G2`… for a group. */
type MixerStripProps = { code: string; selected: boolean } & (
  | { track: Track; group?: undefined; compositionId?: undefined }
  /** A group's strip: the same strip without pan, solo, automation or a picker of where it goes. */
  | { group: MixBus; compositionId: CompositionId; track?: undefined }
);

/**
 * One audio track in the mixer, or one group: name, its effects, where it goes (a track's is a
 * menu), pan, fader with its two meters (the microphone's while a take is recorded onto the
 * track), mute, solo and the automation mode (Read, Touch or Latch; R, the record-arm, is on the
 * track's header). A group has no pan, solo or line: it sends to Master, its name is renamed with
 * a double-click and a right click removes it. With a volume line, the fader is an offset on it,
 * and its readout says so. A click marks the strip (a track's header on the timeline too) and
 * shows its chain in the Channel tab; when marked, it scrolls into view.
 */
export const MixerStrip = memo(function MixerStrip({
  track,
  group,
  compositionId: groupComposition,
  code,
  selected,
}: MixerStripProps) {
  const { bus } = useKernel();
  const project = useModule(projectRef).store;
  const sound = useModule(soundRef);
  const preview = useModule(previewRef);
  const ref = useRef<HTMLDivElement>(null);
  const id = track ? track.id : group.id;
  const compositionId = track ? track.compositionId : groupComposition;
  const unheard = useStore(project.api, (s) => !!track && placesUnheardEffects(s, track.id));
  const effects = useStore(project.api, (s) => chainOf(s, id, compositionId));
  // While a take is recorded onto this track, its meters show the microphone.
  const recording = useStore(
    sound.recorder.state,
    (s) => s.status === "recording" && s.trackId === id,
  );
  const metered = recording ? "input" : id;
  const automation = useAutomationFader(id);
  const { playback } = preview;
  // With a line, what's heard is the line at the playhead plus the fader's trim.
  const heard = useCallback<HeardFeed>(
    (draw) =>
      playback.onTime((time) => {
        const current = project.getState().tracks[id];
        const line = current?.mix?.volumeLine;
        if (current && line) draw(clampDb(lineDb(line, time) + trackMixOf(current).volumeDb));
      }),
    [playback, project, id],
  );
  // A pass ending puts the handle back on the saved level.
  const writing = useStore(sound.automation.state, (s) => s.writing.includes(id));

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selected]);

  const where = { compositionId, busId: id };
  const savedGroup = () =>
    project.getState().compositions[compositionId]?.mix?.buses?.find((b) => b.id === id);
  // A group's fader plays live and sends one `sound.setBus` on release; it has no line.
  const fader = track
    ? automation
    : {
        read: () => savedGroup()?.volumeDb ?? 0,
        onInput: (db: number | null) =>
          preview.sound.previewMix(id, db === null ? null : { volumeDb: db }),
        onCommit: async (volumeDb: number) =>
          void (await bus.run(setBus, { ...where, patch: { volumeDb } })),
      };
  const remove = [
    {
      label: "Remove group",
      destructive: true,
      onSelect: () => void bus.run(removeBus, where),
    },
  ];

  const strip = (
    <div
      ref={ref}
      className={cn(
        "flex w-24 shrink-0 cursor-pointer flex-col gap-1.5 border-r border-dashed border-border-strong p-2",
        group && "bg-muted",
        selected && "shadow-[inset_0_2px_0_var(--mark)]",
      )}
      onClick={() => sound.select(id)}
    >
      <StripName
        name={track ? track.name : group.name}
        {...(group && { group: { bus: group, compositionId } })}
      />
      <div className="-mt-1 text-center font-mono text-sm font-bold text-subtle-foreground">
        {code}
      </div>
      <StripLabel>Effects</StripLabel>
      <EffectChain target={id} compositionId={compositionId} effects={effects} />
      {unheard && (
        <span
          className="-mt-1 truncate text-2xs text-subtle-foreground"
          title="A composition placed here has effects of its own. They aren't heard from outside: only its clips' sound is."
        >
          Inner effects not heard
        </span>
      )}
      {track ? <TrackSends track={track} /> : <SendsTo to="Master" />}
      {track ? (
        <>
          <StripLabel>Pan</StripLabel>
          <PanSlider track={track} />
        </>
      ) : (
        // No pan on a group: the space stays, so every fader starts at the same height.
        <div aria-hidden className="invisible flex flex-col gap-1.5">
          <StripLabel>Pan</StripLabel>
          <div className="h-3.5" />
        </div>
      )}
      <Fader
        value={track ? (writing ? fader.read() : trackMixOf(track).volumeDb) : group.volumeDb}
        label={`${track ? track.name : group.name} level`}
        offset={track?.mix?.volumeLine !== undefined}
        {...(track && { heard })}
        {...fader}
      >
        <Meter target={metered} side="left" />
        <Meter target={metered} side="right" />
      </Fader>
      <div className="flex justify-center gap-0.5">
        {track ? (
          <>
            <LetterToggle
              on={track.muted}
              label={track.muted ? "Unmute track" : "Mute track"}
              tone="mark"
              onToggle={() =>
                void bus.run(setTrackMuted, { trackId: track.id, muted: !track.muted })
              }
            >
              M
            </LetterToggle>
            <SoloButton track={track} />
            <ReadButton target={track.id} />
          </>
        ) : (
          <LetterToggle
            on={group.muted}
            label={group.muted ? "Unmute group" : "Mute group"}
            tone="mark"
            onToggle={() => void bus.run(setBus, { ...where, patch: { muted: !group.muted } })}
          >
            M
          </LetterToggle>
        )}
      </div>
    </div>
  );
  return group ? <ContextMenu items={remove}>{strip}</ContextMenu> : strip;
});
