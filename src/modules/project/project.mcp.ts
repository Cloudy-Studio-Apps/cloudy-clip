import { z } from "zod";
import { commandTool, defineMcpTool, textResult } from "@/core";
import { setFormat } from "./project.commands";
import { orderedJunctions } from "./logic/junctions";
import { orderedTracks, projectDuration, trackClips } from "./project.selectors";
import { projectRef } from "./project.ref";

/** The whole project in an agent-friendly shape: tracks in order with their clips inline. */
const getState = defineMcpTool({
  name: "project_get_state",
  description:
    "Returns the whole project: format, duration, imported media, and tracks (top to bottom) with their clips in timeline order, and junctions (transitions between adjacent clips, ordered by track then time). Times are microseconds. Call this first.",
  input: z.object({}),
  handler(_input, ctx) {
    const state = ctx.require(projectRef).store.getState();
    return textResult({
      format: state.format,
      duration: projectDuration(state),
      media: state.mediaOrder.map((id) => state.media[id]),
      tracks: orderedTracks(state).map((track) => ({
        id: track.id,
        kind: track.kind,
        name: track.name,
        muted: track.muted,
        hidden: track.hidden,
        clips: trackClips(state, track),
      })),
      junctions: orderedJunctions(state),
    });
  },
});

export const projectMcpTools = [getState, commandTool(setFormat, { name: "project_set_format" })];
