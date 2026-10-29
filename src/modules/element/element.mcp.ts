import { z } from "zod";
import { commandTool, defineMcpTool, textResult } from "@/core";
import { projectRef } from "@/modules/project";
import { resetProps, setProps } from "./element.commands";
import { elementRef } from "./element.ref";

/** Describes every kind of clip, so an agent knows what `element_set_props` accepts. */
const describeElements = defineMcpTool({
  name: "element_describe",
  description:
    "Lists every kind of clip (text, media, …): its name, the track kinds it may sit on, whether it plays a file, the shared groups it supports (transform), the JSON schema of the patch element_set_props accepts (ranges, units in descriptions) and its default values for the project's current format. Values a clip doesn't store are these defaults.",
  input: z.object({}),
  handler(_input, ctx) {
    const format = ctx.require(projectRef).store.getState().format;
    return textResult(
      ctx
        .require(elementRef)
        .list()
        .map(({ definition, groups, schema }) => ({
          kind: definition.kind,
          name: definition.name,
          tracks: definition.tracks,
          source: definition.source,
          supports: groups.map((g) => g.id),
          schema: z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }),
          defaults: definition.defaults(format),
        })),
    );
  },
});

/** Agents change any element with the same commands as the inspector. */
export const elementMcpTools = [
  commandTool(setProps, { name: "element_set_props" }),
  commandTool(resetProps, { name: "element_reset_props" }),
  describeElements,
];
