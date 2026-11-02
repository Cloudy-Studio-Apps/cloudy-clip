import {
  clipEnd,
  clipTransform,
  contentTime,
  trackValue,
  type Clip,
  type KeyTrack,
  type ProjectFormat,
} from "@/modules/project";
import type { FramePoint, KeyRef, MotionPathShape } from "../keyframe.types";

const X = "transform.x";
const Y = "transform.y";

/** One axis at a time on the clip's content: its track, else its static value. */
function axis(clip: Clip, path: string, track: KeyTrack | undefined, t: number): number {
  if (track) return Number(trackValue(track, t));
  return clipTransform(clip)[path === X ? "x" : "y"];
}

/** Where the picture's center is in the frame, in output pixels, at a time on the content. */
function positionAt(clip: Clip, format: ProjectFormat, t: number): FramePoint {
  const a = clip.animation;
  return {
    x: format.width / 2 + axis(clip, X, a?.[X], t),
    y: format.height / 2 + axis(clip, Y, a?.[Y], t),
  };
}

/**
 * The path a clip's position follows through its span (`samples` points, frame center plus
 * `transform.x` / `transform.y`), and a diamond at each distinct key time with the keys there.
 * Empty when neither axis has keys.
 */
export function motionPath(clip: Clip, format: ProjectFormat, samples: number): MotionPathShape {
  const tracks = [X, Y].flatMap((path) => {
    const track = clip.animation?.[path];
    return track ? [{ path, track }] : [];
  });
  if (tracks.length === 0) return { points: [], keys: [] };

  const end = Math.max(clip.start, clipEnd(clip) - 1);
  const count = Math.max(2, samples);
  const points = Array.from({ length: count }, (_, i) =>
    positionAt(
      clip,
      format,
      contentTime(clip, Math.round(clip.start + ((end - clip.start) * i) / (count - 1))),
    ),
  );

  const byTime = new Map<number, KeyRef[]>();
  for (const { path, track } of tracks) {
    for (const key of track.keys) {
      const refs = byTime.get(key.t) ?? [];
      refs.push({ clipId: clip.id, path, keyId: key.id });
      byTime.set(key.t, refs);
    }
  }
  const keys = [...byTime]
    .sort(([a], [b]) => a - b)
    .map(([t, ref]) => ({ ref, at: positionAt(clip, format, t) }));
  return { points, keys };
}
