import { z } from "zod";
import { commandTool, defineMcpTool, errorResult, textResult } from "@/core";
import { compositionMarkers, projectRef } from "@/modules/project";
import { addMarker, removeMarker, updateMarker } from "./marker.commands";

/** Reads the markers of a composition, by time. */
const listMarkers = defineMcpTool({
  name: "marker_list",
  readOnly: true,
  description:
    "Returns the markers of a composition (yours open when compositionId is left out), by time, as [{ id, time, note, color }]. Times are microseconds. A marker's note often says what the user wants done there.",
  input: z.object({ compositionId: z.string().optional() }),
  handler(input, ctx) {
    const { store, view } = ctx.require(projectRef);
    const id = input.compositionId ?? view.openFor(ctx.caller.key);
    if (!id || !store.getState().compositions[id]) {
      return errorResult({
        code: "marker.composition_not_found",
        message: id ? `No composition "${id}".` : "No composition is open.",
      });
    }
    return textResult(
      compositionMarkers(store.getState(), id).map(({ id, time, note, color }) => ({
        id,
        time,
        note,
        color,
      })),
    );
  },
});

/** Agents read and edit markers with the same commands as the user. */
export const markerMcpTools = [
  listMarkers,
  commandTool(addMarker, { name: "marker_add" }),
  commandTool(updateMarker, { name: "marker_update" }),
  commandTool(removeMarker, { name: "marker_remove" }),
];
