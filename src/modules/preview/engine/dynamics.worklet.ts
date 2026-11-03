import { createEffectRunner } from "../logic/effects";
import type { DynamicsCommand } from "../preview.types";

/** The worklet scope has no DOM types; this is the little of it the processor uses. */
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare const sampleRate: number;
declare function registerProcessor(
  name: string,
  processor: new (options: {
    processorOptions: { effect: DynamicsCommand };
  }) => AudioWorkletProcessor,
): void;

/**
 * One dynamics effect of any kind (compressor, gate, de-esser, limiter, duck) on a stereo bus: a
 * thin wrapper over `createEffectRunner` (`logic/effects.ts`). It starts with
 * `processorOptions.effect`; each message is the effect's new settings (`DynamicsCommand`). Input 0
 * is the sound, input 1 a duck's key. A mono input feeds both sides; a missing one is silence.
 */
class DynamicsProcessor extends AudioWorkletProcessor {
  private readonly runner = createEffectRunner(sampleRate);
  private silent = new Float32Array(128);

  constructor(options: { processorOptions: { effect: DynamicsCommand } }) {
    super();
    this.runner.set(options.processorOptions.effect);
    this.port.onmessage = ({ data }: MessageEvent<DynamicsCommand>) => this.runner.set(data);
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0] ?? [];
    const outLeft = out[0];
    if (!outLeft) return true;
    const outRight = out[1] ?? outLeft;
    if (this.silent.length < outLeft.length) this.silent = new Float32Array(outLeft.length);
    const sound = inputs[0] ?? [];
    const key = inputs[1] ?? [];
    const left = sound[0] ?? this.silent;
    const keyLeft = key[0] ?? this.silent;
    this.runner.process(left, sound[1] ?? left, keyLeft, key[1] ?? keyLeft, outLeft, outRight);
    return true;
  }
}

registerProcessor("dynamics", DynamicsProcessor);
