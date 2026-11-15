import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { writeKeySpan } from "@/modules/keyframe";
import { contentTime, projectRef, volumeDbSchema } from "@/modules/project";
import { VOLUME_PATH } from "./logic/clipline";
import { audioTrack } from "./sound.guards";

const at = z.number().int().min(0).describe("Timeline time in microseconds");

/**
 * Replaces the part of a clip's volume line between two times with points, in one step
 * (`keyframe.writeSpan`): straight between them, the clip outside the stroke as it was.
 */
export const writeClipPass = defineCommand({
  id: "sound.writeClipPass",
  label: "Draw clip volume",
  description:
    'Replaces the volume keys ("sound.volumeDb") of a clip on an audio track from "from" to "to" (timeline microseconds, both included, inside the clip) with "points" ({at, db}, each inside that span, db -60 to 12), the level running straight from each point to the next. Keys outside the span stay as they were and the clip outside it plays as before: a key just before "from" and just after "to" holds the level the clip had there (its static volume when it had no keys), so the change is a step at the stroke\'s edges. With no points the span is cleared. One stroke of Draw volume over a clip, as one step; the keys move with the clip like any other. Fails with sound.line_range (a point outside the span, a span outside the clip or from after to), sound.clip_not_found and sound.not_audio, changing nothing. Returns { keyIds, edgeKeyIds }: the ids of the keys now in the span, and of the hold keys this write added just outside it, so a caller can remove everything it wrote.',
  undoable: true,
  input: z.object({
    clipId: z.string(),
    from: at,
    to: at,
    points: z.array(z.object({ at, db: volumeDbSchema })),
  }),
  async run(ctx, { clipId, from, to, points }) {
    const state = ctx.require(projectRef).store.getState();
    const clip = state.clips[clipId];
    if (!clip) throw new CommandFailure("sound.clip_not_found", `No clip with id "${clipId}".`);
    audioTrack(state, clip.trackId);
    const end = clip.start + clip.duration;
    if (
      from > to ||
      from < clip.start ||
      to > end ||
      points.some((point) => point.at < from || point.at > to)
    ) {
      throw new CommandFailure(
        "sound.line_range",
        `Every point must sit between from (${from}) and to (${to}), inside the clip (${clip.start} to ${end}), and from must not be after to.`,
      );
    }
    const before = new Set((clip.animation?.[VOLUME_PATH]?.keys ?? []).map((k) => k.id));
    await ctx.execute(writeKeySpan, {
      clipId,
      path: VOLUME_PATH,
      from,
      to,
      points: points.map((point) => ({ at: point.at, value: point.db })),
    });
    const after = ctx.require(projectRef).store.getState().clips[clipId]!;
    const [low, high] = [contentTime(after, from), contentTime(after, to)];
    const keys = after.animation?.[VOLUME_PATH]?.keys ?? [];
    const inside = (t: number) => t >= low && t <= high;
    return {
      keyIds: keys.filter((k) => inside(k.t)).map((k) => k.id),
      edgeKeyIds: keys.filter((k) => !inside(k.t) && !before.has(k.id)).map((k) => k.id),
    };
  },
});

/** Every clip-line command, for the module. */
export const soundClipLineCommands = [writeClipPass];
