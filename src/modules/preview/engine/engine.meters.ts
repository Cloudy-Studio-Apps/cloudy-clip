import { peakToDb } from "../logic/db";
import type { MixLevels, StereoLevel } from "../preview.types";
import type { Meter } from "./engine.types";

/** Samples each read looks back over: about 43 ms at 48 kHz, more than a frame at 60 Hz. */
const WINDOW = 2048;

/** No sound on either side. */
export const SILENCE: StereoLevel = { left: -Infinity, right: -Infinity };

/** Levels of a mix with no sound: no tracks, a silent master. */
export const NO_LEVELS: MixLevels = { tracks: {}, master: SILENCE };

/** The largest sample of a window in dBFS, `-Infinity` for silence. */
function peakDb(analyser: AnalyserNode, samples: Float32Array<ArrayBuffer>): number {
  analyser.getFloatTimeDomainData(samples);
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  return peakToDb(peak);
}

/**
 * A peak meter tapped off `source`: its two sides split to an analyser each. An analyser with
 * nothing after it still runs, so the tap changes nothing downstream.
 */
export function createMeter(context: BaseAudioContext, source: AudioNode): Meter {
  const splitter = context.createChannelSplitter(2);
  const sides = [0, 1].map((channel) => {
    const analyser = context.createAnalyser();
    analyser.fftSize = WINDOW;
    splitter.connect(analyser, channel);
    return analyser;
  });
  const samples = new Float32Array(WINDOW);
  source.connect(splitter);
  return {
    read: () => ({ left: peakDb(sides[0]!, samples), right: peakDb(sides[1]!, samples) }),
    dispose() {
      source.disconnect(splitter);
      splitter.disconnect();
    },
  };
}
