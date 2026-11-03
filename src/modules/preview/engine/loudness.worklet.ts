import { createLoudnessMeter } from "../logic/loudness";
import type { LoudnessMessage } from "../preview.types";

/** The worklet scope has no DOM types; this is the little of it the processor uses. */
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare const sampleRate: number;
declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void;

/** How often a reading is posted, in seconds. */
const POST_SECONDS = 0.1;

/**
 * Measures what reaches it with the pure `createLoudnessMeter` and posts a `LoudnessMessage` every
 * 100 ms. A message `{ reset: n }` starts the measurement over; the readings that follow carry `n`.
 * It makes no sound: the node it belongs to has no output worth hearing.
 */
class LoudnessProcessor extends AudioWorkletProcessor {
  private readonly meter = createLoudnessMeter(sampleRate);
  private readonly every = Math.round(sampleRate * POST_SECONDS);
  private generation = 0;
  private since = 0;
  private readonly silent = new Float32Array(128);

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<{ reset: number }>) => {
      this.generation = event.data.reset;
      this.meter.reset();
      this.since = 0;
    };
  }

  process(inputs: Float32Array[][]): boolean {
    const channels = inputs[0] ?? [];
    const left = channels[0] ?? this.silent;
    // A mono input feeds both sides; no input at all is silence, which still counts as time.
    const right = channels[1] ?? left;
    this.meter.push(left, right);
    this.since += left.length;
    if (this.since >= this.every) {
      this.since = 0;
      const message: LoudnessMessage = { generation: this.generation, reading: this.meter.read() };
      this.port.postMessage(message);
    }
    return true;
  }
}

registerProcessor("loudness", LoudnessProcessor);
