import { notify } from "@/core";
import { thinLevels } from "../../logic/automation";
import { strokeLevels } from "../../logic/trackline";
import { writeClipPass } from "../../sound.clipline.commands";
import { writePass } from "../../sound.line.commands";
import type { StrokePoint, StrokeTarget } from "../../sound.types";

/**
 * Sends a stroke of Draw volume as one command, thinned to within 0.5 dB: `sound.writePass` on the
 * track's line when it's in front, else `sound.writeClipPass` on the clip the stroke starts over
 * (nothing when it starts over none), kept inside that clip.
 */
export function sendStroke(points: readonly StrokePoint[], target: StrokeTarget): void {
  const { inFront } = target;
  const first = points[0];
  if (!first) return;
  const run = inFront ? onLine(points, target) : onClip(points, first, target);
  void run?.then((result) => {
    if (!result.ok) notify("error", result.error.message);
  });
}

/** The stroke on the track's line. */
function onLine(points: readonly StrokePoint[], { bus, trackId, box, pxPerSecond }: StrokeTarget) {
  const levels = thinLevels(strokeLevels(points, box, 0, pxPerSecond, 0, Number.MAX_SAFE_INTEGER));
  const from = levels[0]?.at;
  const to = levels[levels.length - 1]?.at;
  if (from === undefined || to === undefined || to <= from) return null;
  return bus.run(writePass, { target: trackId, from, to, points: levels });
}

/** The stroke on the line of the clip it starts over, kept inside it. */
function onClip(points: readonly StrokePoint[], first: StrokePoint, target: StrokeTarget) {
  const { bus, state, trackId, box, content, pxPerSecond } = target;
  const time = strokeLevels([first], box, 0, pxPerSecond, 0, Number.MAX_SAFE_INTEGER)[0]!.at;
  const clip = Object.values(state.clips).find(
    (c) => c.trackId === trackId && c.start <= time && time < c.start + c.duration,
  );
  const area = clip
    ? content.querySelector<HTMLElement>(`[data-clipline-area="${CSS.escape(clip.id)}"]`)
    : null;
  if (!clip || !area) return null;
  const end = clip.start + clip.duration;
  const levels = thinLevels(
    strokeLevels(points, area.getBoundingClientRect(), clip.start, pxPerSecond, clip.start, end),
  );
  const from = levels[0]?.at;
  const to = levels[levels.length - 1]?.at;
  if (from === undefined || to === undefined || to <= from) return null;
  return bus.run(writeClipPass, { clipId: clip.id, from, to, points: levels });
}
