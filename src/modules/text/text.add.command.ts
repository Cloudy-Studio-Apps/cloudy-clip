import { z } from "zod";
import { CommandFailure, createId, defineCommand, type Micros } from "@/core";
import { minimizeProps } from "@/modules/element";
import { fontsRef } from "@/modules/fonts";
import { previewRef } from "@/modules/preview";
import { projectRef, type Clip } from "@/modules/project";
import { DEFAULT_TEXT, defaultTextStyle, mergeTextStyle } from "./logic/layout";
import { addTrack, findOverlap, freeTrack, overlapError } from "@/modules/timeline";
import { presetStyle } from "./logic/presets";
import { snapStyleToFamily } from "./logic/snap";
import { textPresetId, textStylePatch } from "./text.schema";

/** Length of a new text clip. */
const TEXT_DURATION: Micros = 3_000_000;

/**
 * Adds a text clip over the video. It goes on the top video track with room at that time, or on
 * a new top video track, so it is drawn above the pictures.
 */
export const addText = defineCommand({
  id: "text.add",
  label: "Add text",
  description:
    'Adds a text clip drawn over the video. It shows the words "Text" in the default style (bold, white, centered) unless you pass text, a preset (title, highlight, outline, pop, lower-third) and/or a style patch (applied in that order; pick a font family with fonts_list; weight and italic move to the closest face the family has). Move, scale or rotate it with transform_set_clip_transform; move, trim, split or delete it with the timeline tools. Optional: start (microseconds, defaults to the playhead), duration (microseconds, default 3 s), trackId (a video track; defaults to the top video track with room there, or a new top video track). Fails if the named track is busy there. Returns the new clip.',
  undoable: true,
  input: z.object({
    start: z.number().int().min(0).optional().describe("Microseconds"),
    duration: z.number().int().positive().optional().describe("Microseconds"),
    trackId: z.string().optional(),
    text: z
      .string()
      .refine((t) => t.trim() !== "", "Text can't be empty")
      .optional(),
    preset: textPresetId.optional(),
    style: textStylePatch.optional(),
  }),
  async run(ctx, input) {
    const store = ctx.require(projectRef).store;
    const start = input.start ?? ctx.require(previewRef).playback.getTime();
    const duration = input.duration ?? TEXT_DURATION;

    let trackId = input.trackId;
    if (trackId) {
      const state = store.getState();
      const track = state.tracks[trackId];
      if (!track) throw new CommandFailure("text.track_not_found", `No track with id "${trackId}"`);
      if (track.kind !== "video") {
        throw new CommandFailure(
          "text.kind_mismatch",
          `Text goes on a video track; "${track.name}" is an audio track.`,
        );
      }
      const overlap = findOverlap(state, trackId, start, duration);
      if (overlap) throw overlapError(state, overlap);
    } else {
      trackId =
        freeTrack(store.getState(), "video", start, duration) ??
        (await ctx.execute(addTrack, { kind: "video" })).trackId;
    }

    const format = store.getState().format;
    const text = input.text ?? DEFAULT_TEXT;
    let style = defaultTextStyle(format);
    if (input.preset || input.style) {
      style = snapStyleToFamily(
        mergeTextStyle(
          mergeTextStyle(
            defaultTextStyle(format),
            input.preset ? presetStyle(input.preset, format) : {},
          ),
          input.style ?? {},
        ),
        ctx.require(fontsRef).knownFamilies(),
      );
    }
    const clip: Clip = {
      id: createId("clip"),
      kind: "text",
      trackId,
      start,
      sourceIn: 0,
      duration,
      props: minimizeProps({ text, ...style }, { text: DEFAULT_TEXT, ...defaultTextStyle(format) }),
    };
    ctx.mutate(store, (draft) => {
      draft.clips[clip.id] = clip;
      const track = draft.tracks[clip.trackId]!;
      track.clipIds = [...track.clipIds, clip.id].sort(
        (a, b) => (draft.clips[a]?.start ?? 0) - (draft.clips[b]?.start ?? 0),
      );
    });
    return clip;
  },
});
