import { bandActive, type EqBand } from "@/modules/project";

/** How smoothly a change lands, in seconds. Short enough to follow, long enough not to click. */
const GLIDE = 0.01;

/** Moves a parameter to a value over `GLIDE`, without a click. */
export function glide(param: AudioParam, value: number, context: BaseAudioContext): void {
  param.setTargetAtTime(value, context.currentTime, GLIDE);
}

/** Web Audio's cut filters take Q in dB: this is the plain 12 dB/octave slope FFmpeg's have. */
const CUT_Q_DB = -3.01;

const BIQUAD_TYPE: Record<EqBand["shape"], BiquadFilterType> = {
  bell: "peaking",
  lowShelf: "lowshelf",
  highShelf: "highshelf",
  lowCut: "highpass",
  highCut: "lowpass",
};

/** Up to stereo before a panner: a panner would take 3 dB off a mono source at centre. */
export function createUpmix(context: BaseAudioContext): GainNode {
  const upmix = context.createGain();
  upmix.channelCount = 2;
  upmix.channelCountMode = "explicit";
  upmix.channelInterpretation = "speakers";
  return upmix;
}

/** The six bands of an equalizer, flat. */
export function createEqFilters(context: BaseAudioContext): BiquadFilterNode[] {
  return Array.from({ length: 6 }, () => {
    const filter = context.createBiquadFilter();
    filter.type = "peaking";
    filter.gain.value = 0;
    return filter;
  });
}

/** Sets one filter to a band, or flat when the band or the equalizer is off. */
export function setBand(filter: BiquadFilterNode, band: EqBand, on: boolean): void {
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

/** A stereo panner, centred. */
export function createPanner(context: BaseAudioContext): StereoPannerNode {
  return context.createStereoPanner();
}
