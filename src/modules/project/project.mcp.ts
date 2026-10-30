import { z } from "zod";
import { commandTool, defineMcpTool, textResult } from "@/core";
import { setFormat } from "./project.commands";
import { orderedJunctions } from "./logic/junctions";
import { orderedTracks, trackClips } from "./project.selectors";
import { projectRef } from "./project.ref";

/** The whole project in an agent-friendly shape: tracks in order with their clips inline. */
const getState = defineMcpTool({
  name: "project_get_state",
  readOnly: true,
  description:
    "Returns the whole project: the id of the main composition, each composition with its settings, tracks (top to bottom) with their clips in timeline order and junctions (transitions between adjacent clips, ordered by track then time), and the imported media. Times are microseconds. Call this first.",
  input: z.object({}),
  handler(_input, ctx) {
    const state = ctx.require(projectRef).store.getState();
    return textResult({
      main: state.mainCompositionId,
      compositions: state.compositionOrder.flatMap((id) => {
        const composition = state.compositions[id];
        if (!composition) return [];
        const { id: compositionId, name, format, background, duration, extendToFit } = composition;
        return [
          {
            id: compositionId,
            name,
            format,
            background,
            duration,
            extendToFit,
            tracks: orderedTracks(state, id).map((track) => ({
              id: track.id,
              kind: track.kind,
              name: track.name,
              muted: track.muted,
              hidden: track.hidden,
              clips: trackClips(state, track),
            })),
            junctions: orderedJunctions(state, id),
          },
        ];
      }),
      media: state.mediaOrder.map((id) => state.media[id]),
    });
  },
});

export const projectMcpTools = [getState, commandTool(setFormat, { name: "project_set_format" })];
