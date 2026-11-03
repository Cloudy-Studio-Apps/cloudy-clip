import { dbToLinear, type TrackId } from "@/modules/project";
import type { MixLevels, MonitorState, StereoLevel } from "../preview.types";
import { createMeter } from "./engine.meters";
import { createPanner, createUpmix, GLIDE } from "./engine.soundnodes";
import type { MixBus, TrackBus } from "./engine.types";

/** How far Dim takes the monitor down, in dB. */
const DIM_DB = -20;

/** Moves a parameter to a value without a click. */
function glide(param: AudioParam, value: number, context: BaseAudioContext): void {
  param.setTargetAtTime(value, context.currentTime, GLIDE);
}

/** One audio track's bus: upmix, pan, fader, and a meter after the fader. */
function createTrackBus(context: BaseAudioContext, output: AudioNode): TrackBus {
  const input = createUpmix(context);
  const panner = createPanner(context);
  const fader = context.createGain();
  input.connect(panner).connect(fader).connect(output);
  return { input, panner, fader, meter: createMeter(context, fader) };
}

function dropTrackBus({ input, panner, fader, meter }: TrackBus): void {
  meter.dispose();
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
 * tracks come and go, all into the master, metered after its fader, then the monitor.
 */
export function createMixBus(context: BaseAudioContext): MixBus {
  const master = context.createGain();
  const masterMeter = createMeter(context, master);
  const monitor = createMonitor(context, master);
  const buses = new Map<TrackId, TrackBus>();

  return {
    inputOf: (trackId) => buses.get(trackId)?.input ?? master,
    mix({ tracks, master: masterMix, solo, monitor: monitorState }) {
      const wanted = new Set(tracks.map((track) => track.id));
      for (const [id, bus] of buses) {
        if (wanted.has(id)) continue;
        dropTrackBus(bus);
        buses.delete(id);
      }
      for (const { id, mix, muted } of tracks) {
        let bus = buses.get(id);
        if (!bus) {
          bus = createTrackBus(context, master);
          buses.set(id, bus);
        }
        // Solo silences the other buses, never their elements, so they stay in sync.
        const heard = !muted && (solo.length === 0 || solo.includes(id));
        glide(bus.panner.pan, mix.pan, context);
        glide(bus.fader.gain, heard ? dbToLinear(mix.volumeDb) : 0, context);
      }
      glide(master.gain, dbToLinear(masterMix.volumeDb), context);
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
      masterMeter.dispose();
      master.disconnect();
    },
  };
}
