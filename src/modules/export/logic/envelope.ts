import type { Micros } from "@/core";
import type { KeyTrack } from "@/modules/project";
import type { EnvelopePoint } from "../export.types";

/** How often a value is sampled between its keys. */
const STEP: Micros = 100_000;
/** How long before a break the value is read too, so a jump stays one; FFmpeg's expressions keep
 * time to 10 µs, so it is longer than that. */
const EDGE: Micros = 1_000;
/** How far a point may sit off the straight line between its neighbours and still be dropped. */
const TOLERANCE = 0.001;

/**
 * The content times in `from..to` where a track has a key, its loop and ping-pong repeats
 * included: where its value starts or stops changing, or jumps.
 */
export function keyMoments(track: KeyTrack, from: Micros, to: Micros): Micros[] {
  const first = track.keys[0];
  const last = track.keys[track.keys.length - 1];
  if (!first || !last) return [];
  const span = last.t - first.t;
  const plain = track.keys.map((key) => key.t);
  if (!track.after || span <= 0) return plain.filter((t) => t >= from && t <= to);
  const offsets = plain.map((t) => t - first.t);
  const period = track.after === "loop" ? span : 2 * span;
  if (track.after === "pingpong") offsets.push(...offsets.map((o) => period - o));
  const moments: Micros[] = [];
  const startLap = Math.max(0, Math.floor((from - first.t) / period));
  for (let lap = startLap; first.t + lap * period <= to; lap++) {
    for (const offset of offsets) {
      const t = first.t + lap * period + offset;
      if (t >= from && t <= to) moments.push(t);
    }
  }
  return moments;
}

/**
 * A value that changes over a stretch, as points to draw straight lines between. Sampled at each
 * time in `breaks` (timeline times, and 1 ms before each, so a Hold step stays a step) and every
 * 100 ms; a point on the line between its neighbours, within 0.001, is dropped. There is no cap,
 * so no key is lost on a long stretch. `at` counts from `from`; the first and last points are
 * always kept, and so is every break that bends the line.
 */
export function envelope(
  value: (time: Micros) => number,
  from: Micros,
  to: Micros,
  breaks: readonly Micros[] = [],
): EnvelopePoint[] {
  const span = Math.max(0, to - from);
  const times = new Set<Micros>();
  for (let at = 0; at < span; at += STEP) times.add(at);
  times.add(span);
  for (const time of breaks) {
    const at = time - from;
    if (at > 0 && at < span) times.add(Math.max(0, at - EDGE)).add(at);
  }
  const samples = [...times].sort((a, b) => a - b).map((at) => ({ at, value: value(from + at) }));

  const kept: EnvelopePoint[] = [samples[0]!];
  for (let i = 1; i < samples.length - 1; i++) {
    const a = kept[kept.length - 1]!;
    const here = samples[i]!;
    const b = samples[i + 1]!;
    const online = a.value + ((b.value - a.value) * (here.at - a.at)) / (b.at - a.at);
    if (Math.abs(here.value - online) > TOLERANCE) kept.push(here);
  }
  if (samples.length > 1) kept.push(samples[samples.length - 1]!);
  return kept;
}
