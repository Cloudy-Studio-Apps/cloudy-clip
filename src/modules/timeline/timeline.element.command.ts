import { z } from "zod";
import { CommandFailure, createId, defineCommand, type Micros } from "@/core";
import { checkGroupsApply, elementRef, parsePatch, setProps } from "@/modules/element";
import { previewRef } from "@/modules/preview";
import { projectRef, type Clip, type Track } from "@/modules/project";
import { findOverlap, freeTrack } from "./logic/placement";
import { overlapError, targetComposition } from "./timeline.guards";
import { addTrack } from "./timeline.track.commands";

/** Length of a new clip of an element without a source file. */
const ELEMENT_DURATION: Micros = 3_000_000;

/**
 * Adds a clip of an element without a source file (text, a plugin's element). It goes on the top
 * track of the element's preferred kind with room at that time, or on a new top track.
 */
export const addElement = defineCommand({
  id: "timeline.addElement",
  label: "Add element",
  description:
    'Adds a clip of an element that has no source file, e.g. kind "text". List the kinds, their properties and defaults with element_describe. Optional: props (values to start with, same shape as element_set_props, may include "transform"), start (microseconds, defaults to your playhead), duration (microseconds, default 3 s), trackId (a track the element may sit on; by default the top track of its preferred kind with room there, or a new top track). Fails if the named track is busy there. Media files are placed with timeline_add_clip instead. Returns the new clip.',
  undoable: true,
  input: z.object({
    kind: z.string(),
    props: z.record(z.string(), z.unknown()).optional(),
    start: z.number().int().min(0).optional().describe("Microseconds"),
    duration: z.number().int().positive().optional().describe("Microseconds"),
    trackId: z.string().optional(),
  }),
  async run(ctx, input) {
    const store = ctx.require(projectRef).store;
    const element = ctx.require(elementRef).get(input.kind);
    if (!element) {
      throw new CommandFailure("element.unknown_kind", `No module provides "${input.kind}" clips.`);
    }
    const { definition } = element;
    if (definition.source === "media") {
      throw new CommandFailure(
        "timeline.needs_source",
        `${definition.name} clips play a file; place media with timeline.addClip.`,
      );
    }
    const start = input.start ?? ctx.require(previewRef).clockFor(ctx.actor).getTime();
    const duration = input.duration ?? ELEMENT_DURATION;
    const props = input.props ?? {};
    const patch = parsePatch(element, props);

    let trackId = input.trackId;
    const named = trackId ? store.getState().tracks[trackId] : undefined;
    // Validate everything before writing: the props, and their groups on the track they will sit on.
    const kind = named?.kind ?? definition.tracks[0] ?? "video";
    const probe = {
      id: "",
      kind: definition.kind,
      trackId: "",
      start,
      duration,
      sourceIn: 0,
      props,
    };
    const composition = targetComposition(ctx, trackId);
    const track: Track = named ?? {
      id: "",
      compositionId: composition.id,
      kind,
      name: "",
      clipIds: [],
      muted: false,
      hidden: false,
    };
    checkGroupsApply(element, [{ clip: probe, track }], patch);

    if (trackId) {
      const state = store.getState();
      const track = state.tracks[trackId];
      if (!track) {
        throw new CommandFailure("timeline.track_not_found", `No track with id "${trackId}"`);
      }
      if (!definition.tracks.includes(track.kind)) {
        throw new CommandFailure(
          "timeline.kind_mismatch",
          `${definition.name} goes on a ${definition.tracks.join(" or ")} track; "${track.name}" is a ${track.kind} track.`,
        );
      }
      const overlap = findOverlap(state, trackId, start, duration);
      if (overlap) throw overlapError(state, overlap);
    } else {
      trackId =
        freeTrack(store.getState(), composition, kind, start, duration) ??
        (await ctx.execute(addTrack, { kind })).trackId;
    }

    const clip: Clip = {
      id: createId("clip"),
      kind: definition.kind,
      trackId,
      start,
      sourceIn: 0,
      duration,
      props: {},
    };
    ctx.mutate(store, (draft) => {
      draft.clips[clip.id] = clip;
      const track = draft.tracks[clip.trackId]!;
      track.clipIds = [...track.clipIds, clip.id].sort(
        (a, b) => (draft.clips[a]?.start ?? 0) - (draft.clips[b]?.start ?? 0),
      );
    });
    if (Object.keys(props).length > 0) {
      await ctx.execute(setProps, { clipIds: [clip.id], patch: props });
    }
    return store.getState().clips[clip.id] ?? clip;
  },
});
