import { z } from "zod";
import { commandTool, defineMcpTool, textResult } from "@/core";
import { projectRef } from "@/modules/project";
import { resetProps, setProps } from "./element.commands";
import { elementRef } from "./element.ref";
import { layoutCommands } from "./logic/commands";

/** Describes every kind of clip, so an agent knows what `element_set_props` accepts. */
const describeElements = defineMcpTool({
  name: "element_describe",
  readOnly: true,
  description:
    "Lists every kind of clip (text, media, …): its name, the track kinds it may sit on, whether it plays a file, the shared groups it supports (transform), the JSON schema of the patch element_set_props accepts (ranges, units in descriptions) and its default values for the format of your open composition, and the commands its inspector panel offers (each takes clipIds). Values a clip doesn't store are these defaults.",
  input: z.object({}),
  handler(_input, ctx) {
    const format = ctx.require(projectRef).view.formatFor(ctx.caller.key);
    return textResult(
      ctx
        .require(elementRef)
        .list()
        .map((element) => ({
          kind: element.definition.kind,
          name: element.definition.name,
          tracks: element.definition.tracks,
          source: element.definition.source,
          supports: element.groups.map((g) => g.id),
          schema: z.toJSONSchema(element.schema, { io: "input", unrepresentable: "any" }),
          defaults: element.definition.defaults(format),
          commands: layoutCommands(element),
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
