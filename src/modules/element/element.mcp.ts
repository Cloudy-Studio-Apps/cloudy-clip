import { z } from "zod";
import { commandTool, defineMcpTool, errorResult, textResult, toInputJsonSchema } from "@/core";
import { projectRef } from "@/modules/project";
import { resetProps, setProps } from "./element.commands";
import { elementRef } from "./element.ref";
import { layoutCommands } from "./logic/commands";
import { keyableFields } from "./logic/keyable";

/** Describes every kind of clip, so an agent knows what `element_set_props` accepts. */
const describeElements = defineMcpTool({
  name: "element_describe",
  readOnly: true,
  description:
    "Lists every kind of clip (text, media, …), or only `kind`: its name, the track kinds it may sit on, whether it plays a file, the shared groups it supports (transform, composite), the fields that can be keyed (keyable), the JSON schema of the patch element_set_props accepts (ranges, units in descriptions) and its default values for the format of your open composition, and the commands its inspector panel offers (each takes clipIds). A shared group's schema is given once under `groups` and left out of each element's schema, unless an element narrows it. Values a clip doesn't store are these defaults.",
  input: z.object({
    kind: z.string().optional().describe('One kind of clip, e.g. "text". Default: every kind'),
  }),
  handler(input, ctx) {
    const format = ctx.require(projectRef).view.formatFor(ctx.caller.key);
    const all = ctx.require(elementRef).list();
    const elements = input.kind ? all.filter((e) => e.definition.kind === input.kind) : all;
    if (elements.length === 0) {
      return errorResult({
        code: "element.unknown_kind",
        message: `No kind of clip "${input.kind}". Kinds: ${all.map((e) => e.definition.kind).join(", ")}`,
      });
    }
    const groups: Record<string, unknown> = {};
    return textResult({
      elements: elements.map((element) => {
        const schema = toInputJsonSchema(element.schema);
        const props = schema.properties as Record<string, unknown>;
        for (const { id } of element.groups) {
          // A group's schema is the same on every element unless one narrows it: list it once.
          groups[id] ??= props[id];
          if (JSON.stringify(groups[id]) === JSON.stringify(props[id])) delete props[id];
        }
        return {
          kind: element.definition.kind,
          name: element.definition.name,
          tracks: element.definition.tracks,
          source: element.definition.source,
          supports: element.groups.map((g) => g.id),
          keyable: keyableFields(element).map((f) => f.path),
          schema,
          defaults: element.definition.defaults(format),
          commands: layoutCommands(element),
        };
      }),
      groups,
    });
  },
});

/** Agents change any element with the same commands as the inspector. */
export const elementMcpTools = [
  commandTool(setProps, { name: "element_set_props" }),
  commandTool(resetProps, { name: "element_reset_props" }),
  describeElements,
];
