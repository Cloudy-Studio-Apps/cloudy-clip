import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { contentTime, projectRef, writeSpan } from "@/modules/project";
import { fieldTrack } from "./keyframe.edit.commands";
import { checkKeyValue, keyValue, requireClip, requireField, time } from "./keyframe.guards";
import { keyframeRef } from "./keyframe.ref";
import { writeTracks } from "./keyframe.write";

/** Replaces a clip's keys between two times with straight points, leaving the rest as it plays. */
export const writeKeySpan = defineCommand({
  id: "keyframe.writeSpan",
  label: "Write keyframes",
  description:
    'Replaces the keys of a clip\'s field ("path", e.g. "sound.volumeDb") from "from" to "to" (timeline microseconds, both included, inside the clip) with "points" ({at, value}, each inside that span), in one step. The value runs straight from each point to the next, and the field outside the span plays as before: a key 1 microsecond (of the clip\'s content) before "from" and one after "to" holds the value it had there (its static value when it had no keys), none where a key already sits, so the change is a step at the span\'s edges. With no points the span is cleared. Keys sit on the clip\'s content, so they follow its speed and splits. One drawn stroke. Fails with keyframe.clip_not_found, keyframe.not_keyable, keyframe.invalid_value and keyframe.invalid_span (a point outside the span, a span outside the clip or from after to), changing nothing. Returns { keys }, how many the field has now.',
  undoable: true,
  input: z.object({
    clipId: z.string(),
    path: z.string(),
    from: time,
    to: time,
    points: z.array(z.object({ at: time, value: keyValue })),
  }),
  async run(ctx, { clipId, path, from, to, points }) {
    const state = ctx.require(projectRef).store.getState();
    const clip = requireClip(state, clipId);
    const { field } = requireField(ctx.require(keyframeRef), clip, path);
    const end = clip.start + clip.duration;
    if (
      from > to ||
      from < clip.start ||
      to > end ||
      points.some((point) => point.at < from || point.at > to)
    ) {
      throw new CommandFailure(
        "keyframe.invalid_span",
        `Every point must sit between from (${from}) and to (${to}), inside the clip (${clip.start} to ${end}), and from must not be after to.`,
        { clipId, path },
      );
    }
    const written = points.map((point) => ({
      t: contentTime(clip, point.at),
      value: checkKeyValue(field, point.value),
    }));
    const track = writeSpan(
      fieldTrack(clip, field),
      contentTime(clip, from),
      contentTime(clip, to),
      written,
      field.read(clip),
    );
    const kept = track.keys.length > 0 ? track : undefined;
    await writeTracks(ctx, [
      {
        clipId,
        tracks: { [path]: kept },
        ...(!kept && { statics: { [path]: field.read(clip) } }),
      },
    ]);
    return { keys: track.keys.length };
  },
});
