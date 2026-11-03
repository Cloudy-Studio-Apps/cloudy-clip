import type { LimiterEffect } from "@/modules/project";
import type { LimiterSettings, LimiterState } from "../preview.types";

// A port of FFmpeg's `alimiter` (libavfilter/af_alimiter.c) with `attack=5` (the lookahead),
// `asc` off, `level=disabled` (no make-up to the limit), `level_in`/`level_out` at 1 and `latency`
// off: the output is the input `size / channels − 1` frames later, gain already down when a peak
// arrives, and clipped at the limit. Checked against ffmpeg n9.0.2:
// docs/superpowers/specs/2026-11-03-sound-dynamics-check.md. Type-only imports (worklet).

/** The lookahead, FFmpeg's default `attack`, in ms. */
export const LIMITER_LOOKAHEAD_MS = 5;

/** A limiter for interleaved frames of `channels` samples; its buffers are allocated here, once. */
export function createLimiter(sampleRate: number, channels: number): LimiterState {
  // As FFmpeg: room for 100 ms, and the lookahead in whole frames.
  const room = Math.trunc((sampleRate * channels * 100) / 1000 + channels);
  let size = Math.trunc(sampleRate * (LIMITER_LOOKAHEAD_MS / 1000) * channels);
  size -= size % channels;
  return {
    channels,
    size,
    buffer: new Float64Array(room),
    nextpos: new Int32Array(room).fill(-1),
    nextdelta: new Float64Array(room),
    pos: 0,
    att: 1,
    delta: 0,
    nextiter: 0,
    nextlen: 0,
  };
}

/** `alimiter=limit=<ceilingDb>dB:release=<releaseMs>` at a sample rate. */
export const limiterSettings = (
  { ceilingDb, releaseMs }: Pick<LimiterEffect, "ceilingDb" | "releaseMs">,
  sampleRate: number,
): LimiterSettings => ({
  limit: 10 ** (ceilingDb / 20),
  releaseSamples: sampleRate * (releaseMs / 1000),
});

/** The largest magnitude of the frame stored at `at`. */
function peakAt(s: LimiterState, at: number): number {
  let peak = 0;
  for (let c = 0; c < s.channels; c++) peak = Math.max(peak, Math.abs(s.buffer[at + c]!));
  return peak;
}

/** A peak over the limit was just stored: schedule the gain to be down to it when it comes out. */
function schedule(s: LimiterState, limit: number, releaseSamples: number, peak: number): void {
  const { size, channels, nextpos, nextdelta } = s;
  const rdelta = (1 - Math.min(limit / peak, 1)) / releaseSamples;
  const delta = ((limit / peak - s.att) / size) * channels;
  if (delta < s.delta) {
    s.delta = delta;
    nextpos[0] = s.pos;
    nextpos[1] = -1;
    nextdelta[0] = rdelta;
    s.nextlen = 1;
    s.nextiter = 0;
    return;
  }
  let i = s.nextiter;
  let found = false;
  for (; i < s.nextiter + s.nextlen; i++) {
    const j = i % size;
    const at = nextpos[j]!;
    const ppeak = at >= 0 ? peakAt(s, at) : 0;
    const frames = Math.trunc(((size - at + s.pos) % size) / channels);
    const pdelta = (limit / peak - limit / ppeak) / frames;
    if (pdelta < nextdelta[j]!) {
      nextdelta[j] = pdelta;
      found = true;
      break;
    }
  }
  if (!found) return;
  s.nextlen = i - s.nextiter + 1;
  nextpos[(s.nextiter + s.nextlen) % size] = s.pos;
  nextdelta[(s.nextiter + s.nextlen) % size] = rdelta;
  nextpos[(s.nextiter + s.nextlen + 1) % size] = -1;
  s.nextlen++;
}

/**
 * One frame through the limiter, in place: `frame` holds `channels` samples in, and the frame
 * leaving the lookahead out.
 */
export function limiterStep(s: LimiterState, settings: LimiterSettings, frame: Float64Array): void {
  const { limit, releaseSamples } = settings;
  const { channels, size, buffer, nextpos, nextdelta } = s;
  let peak = 0;
  for (let c = 0; c < channels; c++) {
    buffer[s.pos + c] = frame[c]!;
    peak = Math.max(peak, Math.abs(frame[c]!));
  }
  if (peak > limit) schedule(s, limit, releaseSamples, peak);

  const out = (s.pos + channels) % size;
  peak = peakAt(s, out);
  s.att += s.delta;
  for (let c = 0; c < channels; c++) frame[c] = buffer[out + c]! * s.att;

  if (out === nextpos[s.nextiter]) {
    s.delta = nextdelta[s.nextiter]!;
    s.att = limit / peak;
    s.nextlen -= 1;
    nextpos[s.nextiter] = -1;
    s.nextiter = (s.nextiter + 1) % size;
  }
  if (s.att > 1) {
    s.att = 1;
    s.delta = 0;
    s.nextiter = 0;
    s.nextlen = 0;
    nextpos[0] = -1;
  }
  if (s.att <= 0) {
    s.att = 0.0000000000001;
    s.delta = (1 - s.att) / releaseSamples;
  }
  if (s.att !== 1 && 1 - s.att < 0.0000000000001) s.att = 1;
  if (s.delta !== 0 && Math.abs(s.delta) < 0.00000000000001) s.delta = 0;
  for (let c = 0; c < channels; c++) frame[c] = Math.min(limit, Math.max(-limit, frame[c]!));
  s.pos = (s.pos + channels) % size;
}
