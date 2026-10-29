import { z } from "zod";
import { commandTool, defineMcpTool, textResult } from "@/core";
import { projectRef } from "@/modules/project";
import { addJunction, removeJunction, setJunction } from "./junction.commands";
import { junctionRef } from "./junction.ref";

/** Describes every kind of junction, so an agent knows what `junction_add` and `junction_set` accept. */
const describeJunctions = defineMcpTool({
  name: "junction_describe",
  description:
    "Lists every kind of junction (transitions, a plugin's): its name, the track kinds it may sit on, how it overlaps the two clips (default and minimum duration in microseconds for the project's frame rate; the maximum depends on the clips and is reported by junction_add/junction_set when exceeded; overlap is false when the kind doesn't overlap), the JSON schema of the patch junction_set accepts and its default values for the project's current format.",
  input: z.object({}),
  handler(_input, ctx) {
    const state = ctx.require(projectRef).store.getState();
    return textResult(
      ctx
        .require(junctionRef)
        .list()
        .map(({ definition, schema }) => ({
          kind: definition.kind,
          name: definition.name,
          tracks: definition.tracks,
          overlap: definition.overlap
            ? {
                default: definition.overlap.default,
                min: definition.overlap.min(state),
                max: "up to what the two clips allow (see the junction.invalid_duration error)",
              }
            : false,
          schema: z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }),
          defaults: definition.defaults(state.format),
        })),
    );
  },
});

/** Agents add, change and remove junctions with the same commands as the timeline. */
export const junctionMcpTools = [
  commandTool(addJunction, { name: "junction_add" }),
  commandTool(setJunction, { name: "junction_set" }),
  commandTool(removeJunction, { name: "junction_remove" }),
  describeJunctions,
];
