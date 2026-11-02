import { createLogger } from "@/core";
import { bandActive, pitchShift, type ClipSound, type EqBand } from "@/modules/project";
import type { SoundChain, SoundGraph } from "./engine.types";

const log = createLogger("preview.engine");

/** How smoothly a change lands, in seconds. Short enough to follow, long enough not to click. */
const GLIDE = 0.01;
/** Web Audio's cut filters take Q in dB: this is the plain 12 dB/octave slope FFmpeg's have. */
const CUT_Q_DB = -3.01;
/**
 * What the pitch worklet holds back, in seconds, measured on WebKitGTK (see
 * `docs/superpowers/specs/2026-11-02-audio-preview-check.md`). Pitched sound runs this far ahead
 * of the clock to land on time.
 */
export const PITCH_LEAD_SECONDS = 0.125;

const BIQUAD_TYPE: Record<EqBand["shape"], BiquadFilterType> = {
  bell: "peaking",
  lowShelf: "lowshelf",
  highShelf: "highshelf",
  lowCut: "highpass",
  highCut: "lowpass",
};

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

function setBand(filter: BiquadFilterNode, band: EqBand, on: boolean): void {
  if (!on || !bandActive(band)) {
    filter.type = "peaking";
    filter.gain.value = 0;
    return;
  }
  const cut = band.shape === "lowCut" || band.shape === "highCut";
  filter.type = BIQUAD_TYPE[band.shape];
  filter.frequency.value = band.hz;
  filter.Q.value = cut ? CUT_Q_DB : band.q;
  filter.gain.value = band.db;
}

/** The Web Audio chain of one element: pitch, equalizer, pan, then level. */
function createChain(
  context: AudioContext,
  element: HTMLMediaElement,
  pitchNodes: () => Promise<() => PitchNode>,
): SoundChain {
  const source = context.createMediaElementSource(element);
  // Up to stereo first: a panner would take 3 dB off a mono file at centre.
  const input = context.createGain();
  input.channelCount = 2;
  input.channelCountMode = "explicit";
  input.channelInterpretation = "speakers";
  const filters = Array.from({ length: 6 }, () => {
    const filter = context.createBiquadFilter();
    filter.type = "peaking";
    filter.gain.value = 0;
    return filter;
  });
  const panner = context.createStereoPanner();
  const level = context.createGain();
  source.connect(input);
  const nodes: AudioNode[] = [input, ...filters, panner, level];
  nodes.slice(1).forEach((node, i) => nodes[i]!.connect(node));
  level.connect(context.destination);

  let shown: ClipSound | null = null;
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
    apply(sound, gain) {
      // Never awaited: on an idle context it only settles once media plays.
      if (context.state === "suspended") void context.resume();
      const now = context.currentTime;
      level.gain.setTargetAtTime(gain, now, GLIDE);
      if (sound === shown) return;
      shown = sound;
      panner.pan.setTargetAtTime(sound.pan, now, GLIDE);
      filters.forEach((filter, i) => setBand(filter, sound.eq.bands[i]!, sound.eq.on));
      setPitch(pitchShift(sound));
    },
  };
}

/** Web Audio for the sound elements of one engine, made the first time one needs it. */
export function createSoundGraph(): SoundGraph {
  let context: AudioContext | null = null;
  let pitch: Promise<() => PitchNode> | null = null;
  const chains = new WeakMap<HTMLMediaElement, SoundChain>();
  const failed = new WeakSet<HTMLMediaElement>();

  return {
    chainOf: (element) => chains.get(element),
    attach(element) {
      const known = chains.get(element);
      if (known || failed.has(element) || typeof AudioContext === "undefined") return known;
      try {
        const audio = (context ??= new AudioContext());
        const chain = createChain(audio, element, () => (pitch ??= loadPitch(audio)));
        chains.set(element, chain);
        return chain;
      } catch (error) {
        // An element takes one source, ever, so don't try again.
        failed.add(element);
        log.warn("This sound can't go through Web Audio", error);
        return undefined;
      }
    },
    dispose() {
      void context?.close();
      context = null;
    },
  };
}
