import { createLogger, notify } from "@/core";
import { NO_LEVELS } from "./engine.meters";
import { createDynamicsNodes } from "./engine.dynamics";
import { createLoudnessTap } from "./engine.loudness";
import { createMixBus } from "./engine.mixbus";
import { createChain, loadPitch } from "./engine.soundchain";
import type {
  DynamicsNodes,
  LoudnessTap,
  MixBus,
  MixUpdate,
  PitchNode,
  SoundChain,
  SoundGraph,
} from "./engine.types";

const log = createLogger("preview.engine");

/** Web Audio for the sound elements of one engine, made the first time one needs it. */
export function createSoundGraph(): SoundGraph {
  let context: AudioContext | null = null;
  let buses: MixBus | null = null;
  let dynamics: DynamicsNodes | null = null;
  /** The context or its buses couldn't be made: told once, never tried again. */
  let unavailable = false;
  let update: MixUpdate | null = null;
  let loudness: LoudnessTap | null = null;
  /** Whether the engine plays; a tap made later starts from it. */
  let playing = false;
  let closed = false;
  let pitch: Promise<() => PitchNode> | null = null;
  const chains = new WeakMap<HTMLMediaElement, SoundChain>();
  const failed = new WeakSet<HTMLMediaElement>();

  /**
   * Starts listening to the master, once per engine. The worklet loads in the background; when it
   * can't, loudness stays null, the user is told once and the rest of the graph goes on.
   */
  const measureLoudness = (audio: AudioContext, master: AudioNode) => {
    const report = (error: unknown) => {
      if (closed) return;
      log.warn("The loudness meter isn't available", error);
      notify(
        "error",
        "The preview can't measure loudness here, so the loudness readout stays empty. Playback and the level meters are unaffected.",
      );
    };
    createLoudnessTap(audio, master, report).then((tap) => {
      if (closed) return tap.dispose();
      loudness = tap;
      tap.setActive(playing);
    }, report);
  };

  /**
   * The context with its buses, made on first use; null when Web Audio isn't there or the graph
   * was disposed (no context is built after that).
   */
  const open = (): AudioContext | null => {
    if (closed) return null;
    if (context || unavailable) return context;
    unavailable = true;
    if (typeof AudioContext === "undefined") return null;
    let audio: AudioContext | null = null;
    try {
      audio = new AudioContext();
      dynamics = createDynamicsNodes(audio, () => {
        if (update) buses?.mix(update);
      });
      buses = createMixBus(audio, dynamics);
      if (update) buses.mix(update);
      context = audio;
      unavailable = false;
      measureLoudness(audio, buses.master);
    } catch (error) {
      dynamics?.dispose();
      dynamics = null;
      void audio?.close();
      log.warn("The preview has no Web Audio", error);
      notify(
        "error",
        "The preview's sound can't go through the mixer, so clips play at their own level: track volume, solo and meters don't reach them.",
      );
    }
    return context;
  };

  return {
    chainOf: (element) => chains.get(element),
    attach(element, name) {
      const known = chains.get(element);
      if (known || failed.has(element)) return known;
      const audio = open();
      if (!audio) return undefined;
      try {
        const chain = createChain(audio, element, () => (pitch ??= loadPitch(audio)));
        chains.set(element, chain);
        return chain;
      } catch (error) {
        // An element takes one source, ever, so don't try again.
        failed.add(element);
        log.warn("This sound can't go through Web Audio", error);
        notify(
          "error",
          `"${name}" can't go through the mixer, so it plays at its own level: track volume, solo and meters don't reach it.`,
        );
        return undefined;
      }
    },
    busOf: (trackId) => buses?.inputOf(trackId),
    mix(next) {
      update = next;
      buses?.mix(next);
    },
    levels: () => buses?.levels() ?? NO_LEVELS,
    loudness: () => loudness?.read() ?? null,
    resetLoudness: () => loudness?.reset(),
    setPlaying(next) {
      playing = next;
      loudness?.setActive(next);
    },
    dispose() {
      closed = true;
      loudness?.dispose();
      loudness = null;
      dynamics?.dispose();
      dynamics = null;
      buses?.dispose();
      buses = null;
      void context?.close();
      context = null;
    },
  };
}
