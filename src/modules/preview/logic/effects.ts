import type {
  DeesserSettings,
  DynamicsCommand,
  DynamicsCurve,
  EffectRunner,
  LimiterSettings,
} from "../preview.types";
import { createDeesserState, deesserSettings, deesserStep } from "./deesser";
import {
  compressorCurve,
  createDynamicsState,
  duckCurve,
  dynamicsGain,
  gateCurve,
  linkedLevel,
} from "./dynamics";
import { createLimiter, limiterSettings, limiterStep } from "./limiter";

// What the dynamics worklet runs, kept here so it is plain code: one effect of any dynamics kind
// on a stereo signal, block by block. Type-only imports (worklet).

/** The curve of a compressor, gate or duck; null for the kinds that have their own algorithm. */
function curveOf(command: DynamicsCommand, sampleRate: number): DynamicsCurve | null {
  switch (command.kind) {
    case "compressor":
      return compressorCurve(command.params, sampleRate);
    case "gate":
      return gateCurve(command, sampleRate);
    case "duck":
      return duckCurve(command, sampleRate);
    default:
      return null;
  }
}

/**
 * Runs one effect on stereo blocks. `set` changes the settings and keeps the state (an envelope, the
 * limiter's lookahead), so a parameter change doesn't click. Off, the sound passes through.
 */
export function createEffectRunner(sampleRate: number): EffectRunner {
  const detector = createDynamicsState();
  const deessers = [createDeesserState(), createDeesserState()] as const;
  const limiter = createLimiter(sampleRate, 2);
  const frame = new Float64Array(2);
  let command: DynamicsCommand | null = null;
  let curve: DynamicsCurve | null = null;
  let deesser: DeesserSettings | null = null;
  let limit: LimiterSettings | null = null;

  return {
    set(next) {
      command = next;
      curve = curveOf(next, sampleRate);
      deesser = next.kind === "deesser" ? deesserSettings(next, sampleRate) : null;
      limit = next.kind === "limiter" ? limiterSettings(next, sampleRate) : null;
    },
    process(left, right, keyLeft, keyRight, outLeft, outRight) {
      const n = outLeft.length;
      if (!command?.on) {
        outLeft.set(left.subarray(0, n));
        outRight.set(right.subarray(0, n));
        return;
      }
      if (curve) {
        // A duck listens to its key; the others to what they process.
        const ownKey = command.kind !== "duck";
        for (let i = 0; i < n; i++) {
          const l = left[i]!;
          const r = right[i]!;
          const level = ownKey ? linkedLevel(l, r) : linkedLevel(keyLeft[i]!, keyRight[i]!);
          const gain = dynamicsGain(detector, curve, level);
          outLeft[i] = l * gain;
          outRight[i] = r * gain;
        }
      } else if (deesser) {
        for (let i = 0; i < n; i++) {
          outLeft[i] = deesserStep(deessers[0], deesser, left[i]!);
          outRight[i] = deesserStep(deessers[1], deesser, right[i]!);
        }
      } else if (limit) {
        for (let i = 0; i < n; i++) {
          frame[0] = left[i]!;
          frame[1] = right[i]!;
          limiterStep(limiter, limit, frame);
          outLeft[i] = frame[0];
          outRight[i] = frame[1];
        }
      }
    },
  };
}
