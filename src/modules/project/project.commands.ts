import { z } from "zod";
import { defineCommand } from "@/core";
import { projectRef } from "./project.ref";
import { FORMAT_PRESETS } from "./project.store";

/** Changes the output format (canvas size) of the project. */
export const setFormat = defineCommand({
  id: "project.setFormat",
  label: "Change format",
  description:
    'Sets the output format of the project: "9:16" (vertical, 1080x1920), "16:9" (1920x1080) or "1:1" (1080x1080).',
  undoable: true,
  input: z.object({ preset: z.enum(["9:16", "16:9", "1:1"]) }),
  run(ctx, { preset }) {
    const project = ctx.require(projectRef);
    const { id } = project.view.requireOpen(ctx.actor);
    ctx.mutate(project.store, (draft) => {
      draft.compositions[id]!.format = { ...FORMAT_PRESETS[preset] };
    });
    return FORMAT_PRESETS[preset];
  },
});

export const projectCommands = [setFormat];
