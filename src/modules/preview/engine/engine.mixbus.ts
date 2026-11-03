import { dbToLinear, type TrackId } from "@/modules/project";
import type { MixLevels, MonitorState, StereoLevel } from "../preview.types";
import { createEffectChain } from "./engine.effects";
import { createMeter } from "./engine.meters";
import { createPanner, createUpmix, glide } from "./engine.soundnodes";
import type { DynamicsNodes, MixBus, TrackBus } from "./engine.types";

/** How far Dim takes the monitor down, in dB. */
const DIM_DB = -20;

/**
 * One audio track's bus: upmix, effects, pan, fader, and a meter after the fader. It starts at its
 * pan and level, so a muted or soloed-out track never sounds while it's made; its effects are set
 * by the next pass of `mix`.
 */
function createTrackBus(
  context: BaseAudioContext,
  output: AudioNode,
  dynamics: DynamicsNodes,
  pan: number,
  level: number,
): TrackBus {
  const input = createUpmix(context);
  const panner = createPanner(context);
  panner.pan.value = pan;
  const fader = context.createGain();
  fader.gain.value = level;
  const effects = createEffectChain(context, input, panner, dynamics);
  panner.connect(fader).connect(output);
  return { input, effects, panner, fader, meter: createMeter(context, fader) };
}

function dropTrackBus({ input, effects, panner, fader, meter }: TrackBus): void {
  meter.dispose();
  effects.dispose();
  for (const node of [input, panner, fader]) node.disconnect();
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
 * The buses of one context: a bus per audio track of the open composition, made and dropped as
 * tracks come and go, all into the master (fader, then its effects), metered after them, then the
 * monitor. Dynamics effects run in the worklet `dynamics` loads.
 */
export function createMixBus(context: BaseAudioContext, dynamics: DynamicsNodes): MixBus {
  const masterFader = context.createGain();
  const master = context.createGain();
  const masterEffects = createEffectChain(context, masterFader, master, dynamics);
  const masterMeter = createMeter(context, master);
  const monitor = createMonitor(context, master);
  const buses = new Map<TrackId, TrackBus>();
  /** The first mix sets the master's level outright, so it never glides in from unity. */
  let started = false;

  return {
    master,
    inputOf: (trackId) => buses.get(trackId)?.input ?? masterFader,
    mix({ tracks, master: masterMix, solo, monitor: monitorState }) {
      const wanted = new Set(tracks.map((track) => track.id));
      for (const [id, bus] of buses) {
        if (wanted.has(id)) continue;
        dropTrackBus(bus);
        buses.delete(id);
      }
      for (const { id, mix, muted } of tracks) {
        // Solo silences the other buses, never their elements, so they stay in sync.
        const heard = !muted && (solo.length === 0 || solo.includes(id));
        const level = heard ? dbToLinear(mix.volumeDb) : 0;
        const bus = buses.get(id);
        if (!bus) {
          buses.set(id, createTrackBus(context, masterFader, dynamics, mix.pan, level));
          continue;
        }
        glide(bus.panner.pan, mix.pan, context);
        glide(bus.fader.gain, level, context);
      }
      // Every bus exists now, so a duck finds the faders of the tracks it listens to.
      const keyOf = (trackId: TrackId) => buses.get(trackId)?.fader;
      for (const { id, mix } of tracks) buses.get(id)?.effects.set(mix.effects ?? [], keyOf);
      masterEffects.set(masterMix.effects ?? [], keyOf);
      const masterLevel = dbToLinear(masterMix.volumeDb);
      if (started) glide(masterFader.gain, masterLevel, context);
      else masterFader.gain.value = masterLevel;
      started = true;
      monitor(monitorState);
    },
    levels(): MixLevels {
      const levels: Record<TrackId, StereoLevel> = {};
      for (const [id, bus] of buses) levels[id] = bus.meter.read();
      return { tracks: levels, master: masterMeter.read() };
    },
    dispose() {
      for (const bus of buses.values()) dropTrackBus(bus);
      buses.clear();
      masterEffects.dispose();
      masterMeter.dispose();
      masterFader.disconnect();
      master.disconnect();
    },
  };
}
