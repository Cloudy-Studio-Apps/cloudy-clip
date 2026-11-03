import { z } from "zod";
import { defineMcpTool, textResult } from "@/core";
import { orderedJunctions } from "./logic/junctions";
import { compositionMixOf, trackMixOf } from "./logic/mix";
import { compositionMarkers, orderedTracks, trackClips } from "./project.selectors";
import { projectRef } from "./project.ref";

/** The whole project in an agent-friendly shape: tracks in order with their clips inline. */
const getState = defineMcpTool({
  name: "project_get_state",
  readOnly: true,
  description:
    "Returns the whole project: its description (what it's about, when given), the id of the main composition, the one you have open (`open`), each composition with its settings and mix (master, which of the two mixes is active and the other one), tracks (top to bottom, audio ones with their mix) with their clips in timeline order, junctions (transitions between adjacent clips, ordered by track then time) and markers (bookmarks with a note and a color, by time), the imported media, bins and solid colors. Times are microseconds. Call this first.",
  input: z.object({}),
  handler(_input, ctx) {
    const { store, view } = ctx.require(projectRef);
    const state = store.getState();
    return textResult({
      description: state.description,
      main: state.mainCompositionId,
      open: view.openFor(ctx.caller.key),
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
            mix: compositionMixOf(composition),
            tracks: orderedTracks(state, id).map((track) => ({
              id: track.id,
              kind: track.kind,
              name: track.name,
              muted: track.muted,
              hidden: track.hidden,
              mix: track.kind === "audio" ? trackMixOf(track) : undefined,
              clips: trackClips(state, track),
            })),
            junctions: orderedJunctions(state, id),
            markers: compositionMarkers(state, id),
          },
        ];
      }),
      media: state.mediaOrder.map((id) => state.media[id]),
      bins: state.binOrder.map((id) => state.bins[id]),
      solids: state.solidOrder.map((id) => state.solids[id]),
    });
  },
});

export const projectMcpTools = [getState];
