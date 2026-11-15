import type { Micros } from "@/core";
import { dbToLinear, type BusId, type TrackId } from "@/modules/project";
import type { MixLevels, MonitorState, StereoLevel } from "../preview.types";
import { createEffectChain } from "./engine.effects";
import { createFaderLevel, NO_LINES } from "./engine.line";
import { createMeter } from "./engine.meters";
import { createPanner, createUpmix, glide } from "./engine.soundnodes";
import type { DynamicsNodes, FaderTarget, KeyOf, MixBus, TrackBus } from "./engine.types";

/** How far Dim takes the monitor down, in dB. */
const DIM_DB = -20;

/**
 * One audio track's bus (or a group's: the same bus, centred, never soloed out, whose input is the
 * buses of the tracks sent to it): upmix, effects, pan, fader (volume and mute, or the volume line
 * with the volume as an offset on top), solo, and a meter after them. Solo is a gain of its own after the
 * fader because it is only how the user listens: a duck's key is taken between the two, so
 * soloing doesn't stop ducking (the export has no solo), while a muted listened track keys
 * nothing; the line is in the key, as it is in the export. It starts at its pan and levels (the
 * line's at `time`), so a muted or soloed-out track never sounds while it's made; its effects are
 * set by the next pass of `mix`.
 */
function createTrackBus(
  context: BaseAudioContext,
  output: AudioNode,
  dynamics: DynamicsNodes,
  pan: number,
  level: FaderTarget,
  soloLevel: number,
  time: Micros,
): TrackBus {
  const input = createUpmix(context);
  const panner = createPanner(context);
  panner.pan.value = pan;
  const fader = context.createGain();
  const faderLevel = createFaderLevel(fader.gain, context, time);
  faderLevel.set(level);
  const solo = context.createGain();
  solo.gain.value = soloLevel;
  const effects = createEffectChain(context, input, panner, dynamics);
  panner.connect(fader).connect(solo).connect(output);
  const meter = createMeter(context, solo);
  return { input, effects, panner, fader, level: faderLevel, solo, meter, to: output };
}

/** Sends a bus somewhere else (a group, or the master); nothing when it already goes there. */
function routeBus(bus: TrackBus, to: AudioNode): void {
  if (bus.to === to) return;
  bus.solo.disconnect(bus.to);
  bus.solo.connect(to);
  bus.to = to;
}

function dropTrackBus({ input, effects, panner, fader, solo, meter }: TrackBus): void {
  meter.dispose();
  effects.dispose();
  for (const node of [input, panner, fader, solo]) node.disconnect();
}

/**
 * Mono, Dim and the speaker volume, from the master to the speakers. Mono sums both sides with a
 * `ChannelMergerNode` into each output; the stereo and mono paths cross over by their gains.
 */
function createMonitor(context: BaseAudioContext, master: AudioNode) {
  const stereo = context.createGain();
  const splitter = context.createChannelSplitter(2);
  const merger = context.createChannelMerger(2);
  const mono = context.createGain();
  const dim = context.createGain();
  const speaker = context.createGain();
  master.connect(stereo).connect(dim);
  master.connect(splitter);
  for (const side of [0, 1]) for (const out of [0, 1]) splitter.connect(merger, side, out);
  merger.connect(mono).connect(dim);
  mono.gain.value = 0;
  dim.connect(speaker).connect(context.destination);
  return (state: MonitorState) => {
    glide(stereo.gain, state.mono ? 0 : 1, context);
    // Half of each: a centred sound stays at the level it has in stereo.
    glide(mono.gain, state.mono ? 0.5 : 0, context);
    glide(dim.gain, state.dim ? dbToLinear(DIM_DB) : 1, context);
    glide(speaker.gain, dbToLinear(state.speakerDb), context);
  };
}

/**
 * The buses of one context: a bus per audio track of the open composition and one per group, made
 * and dropped as they come and go; a track goes into its group's bus or the master, a group into
 * the master (fader: its volume, 0 when muted, or its volume line with the volume on top; then its
 * pan, a balance with a track's law; then its effects), metered after them, then the monitor. A
 * muted master meters and measures silence, as a muted track's bus does. Solo silences the
 * tracks' buses only, so a soloed track is heard through its group. Dynamics effects run in the
 * worklet `dynamics` loads.
 */
export function createMixBus(context: BaseAudioContext, dynamics: DynamicsNodes): MixBus {
  const masterFader = context.createGain();
  const masterLevel = createFaderLevel(masterFader.gain, context, 0);
  const masterPan = createPanner(context);
  masterFader.connect(masterPan);
  const master = context.createGain();
  const masterEffects = createEffectChain(context, masterPan, master, dynamics);
  const masterMeter = createMeter(context, master);
  const monitor = createMonitor(context, master);
  const buses = new Map<TrackId, TrackBus>();
  const groups = new Map<BusId, TrackBus>();
  /** The first mix sets the master's pan outright, so it never glides in from the centre. */
  let started = false;
  /** The playhead, for a bus made between frames. */
  let clock: Micros = 0;

  return {
    master,
    inputOf: (trackId) => buses.get(trackId)?.input ?? masterFader,
    // Groups have no line: their faders are set by `mix` alone.
    follow(time, playing, until) {
      clock = time;
      for (const bus of buses.values()) bus.level.follow(time, playing, until);
      masterLevel.follow(time, playing, until);
    },
    mix({ tracks, groups: groupMixes, master: masterMix, solo, monitor: monitorState }) {
      // Groups first, so the tracks find the bus they send to.
      for (const { id, volumeDb, muted } of groupMixes) {
        const level = { lines: NO_LINES, offsetDb: volumeDb, muted };
        const group = groups.get(id);
        if (group) group.level.set(level);
        else groups.set(id, createTrackBus(context, masterFader, dynamics, 0, level, 1, clock));
      }
      const wantedGroups = new Set(groupMixes.map((group) => group.id));
      const wanted = new Set(tracks.map((track) => track.id));
      for (const [id, bus] of buses) {
        if (wanted.has(id)) continue;
        dropTrackBus(bus);
        buses.delete(id);
      }
      for (const { id, mix, muted } of tracks) {
        // Solo silences the other buses, never their elements, so they stay in sync.
        const soloLevel = solo.length === 0 || solo.includes(id) ? 1 : 0;
        const lines = mix.volumeLine ? [{ line: mix.volumeLine, shift: 0 }] : [];
        const level = { lines, offsetDb: mix.volumeDb, muted };
        // A group that isn't in this mix (about to be dropped) sends to Master, as the export does.
        const { busId } = mix;
        const group =
          busId !== undefined && wantedGroups.has(busId) ? groups.get(busId) : undefined;
        const to = group?.input ?? masterFader;
        const bus = buses.get(id);
        if (!bus) {
          buses.set(id, createTrackBus(context, to, dynamics, mix.pan, level, soloLevel, clock));
          continue;
        }
        routeBus(bus, to);
        glide(bus.panner.pan, mix.pan, context);
        bus.level.set(level);
        glide(bus.solo.gain, soloLevel, context);
      }
      // Dropped only now: no track sends to them any more.
      for (const [id, group] of groups) {
        if (wantedGroups.has(id)) continue;
        dropTrackBus(group);
        groups.delete(id);
      }
      // Every bus exists now, so a duck finds the faders of the tracks and groups it listens to
      // (before solo).
      const keyOf: KeyOf = (id) => buses.get(id)?.fader ?? groups.get(id)?.fader;
      for (const { id, mix } of tracks) buses.get(id)?.effects.set(mix.effects ?? [], keyOf);
      for (const { id, effects } of groupMixes) groups.get(id)?.effects.set(effects ?? [], keyOf);
      masterEffects.set(masterMix.effects ?? [], keyOf);
      const masterLines = masterMix.volumeLine ? [{ line: masterMix.volumeLine, shift: 0 }] : [];
      masterLevel.set({
        lines: masterLines,
        // The trim is on the same stage as the fader, as in the export.
        offsetDb: masterMix.volumeDb + (masterMix.trimDb ?? 0),
        muted: masterMix.muted === true,
      });
      const pan = masterMix.pan ?? 0;
      if (started) glide(masterPan.pan, pan, context);
      else masterPan.pan.value = pan;
      started = true;
      monitor(monitorState);
    },
    levels(): MixLevels {
      const levels: Record<TrackId, StereoLevel> = {};
      for (const [id, bus] of buses) levels[id] = bus.meter.read();
      for (const [id, group] of groups) levels[id] = group.meter.read();
      return { tracks: levels, master: masterMeter.read() };
    },
    reduction: (target) =>
      (target === "master"
        ? masterEffects
        : (buses.get(target) ?? groups.get(target))?.effects
      )?.reduction() ?? 0,
    spectrum: (into) => masterMeter.spectrum(into),
    dispose() {
      for (const bus of buses.values()) dropTrackBus(bus);
      buses.clear();
      for (const group of groups.values()) dropTrackBus(group);
      groups.clear();
      masterEffects.dispose();
      masterMeter.dispose();
      masterFader.disconnect();
      masterPan.disconnect();
      master.disconnect();
    },
  };
}
