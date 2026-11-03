/** The worklet scope has no DOM types; this is the little of it the processor uses. */
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void;

/** Samples gathered before they are posted: about 12 ms at 44.1 kHz, so the meter keeps up. */
const BATCH = 512;

/**
 * Copies the microphone out of the audio thread: the first channel of its input, in batches of
 * `BATCH` samples (a `Float32Array`, transferred). Its output stays silent.
 */
class RecordProcessor extends AudioWorkletProcessor {
  private batch = new Float32Array(BATCH);
  private filled = 0;

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    let from = 0;
    while (from < channel.length) {
      const take = Math.min(channel.length - from, BATCH - this.filled);
      this.batch.set(channel.subarray(from, from + take), this.filled);
      this.filled += take;
      from += take;
      if (this.filled === BATCH) {
        this.port.postMessage(this.batch, [this.batch.buffer]);
        this.batch = new Float32Array(BATCH);
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor("sound-record", RecordProcessor);
