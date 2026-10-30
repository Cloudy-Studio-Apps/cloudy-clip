import { z } from "zod";
import { commandTool, defineMcpTool, textResult } from "@/core";
import { projectRef } from "@/modules/project";
import { applyTransition } from "./transition.commands";
import { transitionRef } from "./transition.ref";

/** Lists the transition presets, so an agent knows what `transition_apply` accepts. */
const listPresets = defineMcpTool({
  name: "transition_list_presets",
  readOnly: true,
  description:
    "Lists every transition preset: id, name, category, the JSON schema of its options and their default values for the format of your open composition. Use the id with transition_apply.",
  input: z.object({}),
  handler(_input, ctx) {
    const api = ctx.require(transitionRef);
    const format = ctx.require(projectRef).view.formatFor(ctx.caller.key);
    return textResult(
      api.list().map((preset) => ({
        id: preset.id,
        name: preset.name,
        category: preset.category,
        options: z.toJSONSchema(api.optionsSchema(preset), {
          io: "input",
          unrepresentable: "any",
        }),
        defaults: preset.defaults(format),
      })),
    );
  },
});

/** Agents apply transitions with the same command as the Transitions tab. */
export const transitionMcpTools = [
  commandTool(applyTransition, { name: "transition_apply" }),
  listPresets,
];
