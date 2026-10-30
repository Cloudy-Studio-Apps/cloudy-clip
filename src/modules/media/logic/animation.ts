import { microsToSeconds, type Micros } from "@/core";
import type { ImageAnimation } from "../media.types";

/** The frame showing `elapsed` after a clip starts. It loops, so a stretched clip keeps moving. */
export function frameIndexAt({ frames, fps }: ImageAnimation, elapsed: Micros): number {
  return Math.floor(microsToSeconds(elapsed) * fps) % frames;
}

/** The frame at `elapsed`, then those up to `ahead` later, each once. */
export function frameIndexesAt(
  animation: ImageAnimation,
  elapsed: Micros,
  ahead: Micros,
): number[] {
  const first = frameIndexAt(animation, elapsed);
  const count = 1 + Math.ceil(microsToSeconds(ahead) * animation.fps);
  return Array.from({ length: Math.min(count, animation.frames) }, (_, i) => {
    return (first + i) % animation.frames;
  });
}
