import { createLogger, notify } from "@/core";
import { pitchShift, type ClipSound } from "@/modules/project";
import { NO_LEVELS } from "./engine.meters";
import { createLoudnessTap } from "./engine.loudness";
import { createMixBus } from "./engine.mixbus";
import { createEqFilters, createPanner, createUpmix, glide, setBand } from "./engine.soundnodes";
import type { LoudnessTap, MixBus, MixUpdate, SoundChain, SoundGraph } from "./engine.types";

const log = createLogger("preview.engine");

/**
 * What the pitch worklet holds back, in seconds, measured on WebKitGTK (see
 * `docs/superpowers/specs/2026-11-02-audio-preview-check.md`). Pitched sound runs this far ahead
 * of the clock to land on time.
 */
export const PITCH_LEAD_SECONDS = 0.125;

type PitchNode = AudioWorkletNode & { pitch: AudioParam };

/** Loads the worklet into a context once. */
async function loadPitch(context: AudioContext): Promise<() => PitchNode> {
  const [{ SoundTouchNode }, processor] = await Promise.all([
    import("@soundtouchjs/audio-worklet"),
    import("@soundtouchjs/audio-worklet/processor?url"),
  ]);
  await SoundTouchNode.register(context, processor.default);
  return () => new SoundTouchNode({ context }) as unknown as PitchNode;
}

/** The Web Audio chain of one element: pitch, equalizer, pan, then level, into a bus. */
function createChain(
  context: AudioContext,
  element: HTMLMediaElement,
  pitchNodes: () => Promise<() => PitchNode>,
): SoundChain {
  const source = context.createMediaElementSource(element);
  const input = createUpmix(context);
  const filters = createEqFilters(context);
  const panner = createPanner(context);
  const level = context.createGain();
  source.connect(input);
  const nodes: AudioNode[] = [input, ...filters, panner, level];
  nodes.slice(1).forEach((node, i) => nodes[i]!.connect(node));

  let shown: ClipSound | null = null;
  let shownPan: number | null = null;
  let bus: AudioNode | null = null;
  let pitch: PitchNode | null = null;
  let wanted = 0;

  const route = (node: AudioNode | null) => {
    source.disconnect();
    if (!node) return void source.connect(input);
    source.connect(node);
    node.connect(input);
  };
  const setPitch = (shift: number) => {
    wanted = shift;
    if (shift === 0) {
      if (pitch) route(null);
      pitch?.disconnect();
      pitch = null;
      return;
    }
    const ratio = 2 ** (shift / 12);
    if (pitch) return void (pitch.pitch.value = ratio);
    pitchNodes().then(
      (create) => {
        if (wanted !== shift || pitch) return;
        pitch = create();
        pitch.pitch.value = ratio;
        route(pitch);
      },
      (error: unknown) => log.warn("Pitch isn't available", error),
    );
  };

  return {
    apply(sound, gain, pan = sound.pan) {
      // Never awaited: on an idle context it only settles once media plays.
      if (context.state === "suspended") void context.resume();
      glide(level.gain, gain, context);
      if (pan !== shownPan) {
        shownPan = pan;
        glide(panner.pan, pan, context);
      }
      if (sound === shown) return;
      shown = sound;
      filters.forEach((filter, i) => setBand(filter, sound.eq.bands[i]!, sound.eq.on));
      setPitch(pitchShift(sound));
    },
    routeTo(next) {
      // The pool hands an element to clips of any track, so its chain follows the slot.
      if (next === bus) return;
      if (bus) level.disconnect(bus);
      level.connect(next);
      bus = next;
    },
  };
}

/** Web Audio for the sound elements of one engine, made the first time one needs it. */
export function createSoundGraph(): SoundGraph {
  let context: AudioContext | null = null;
  let buses: MixBus | null = null;
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
      buses = createMixBus(audio);
      if (update) buses.mix(update);
      context = audio;
      unavailable = false;
      measureLoudness(audio, buses.master);
    } catch (error) {
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
      buses?.dispose();
      buses = null;
      void context?.close();
      context = null;
    },
  };
}
