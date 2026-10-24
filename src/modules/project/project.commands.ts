import { z } from "zod";
import { defineCommand } from "@/core";
import { FORMAT_PRESETS, projectStore } from "./project.store";

/** Changes the output format (canvas size) of the project. */
export const setFormat = defineCommand({
  id: "project.setFormat",
  label: "Change format",
  description:
    'Sets the output format of the project: "9:16" (vertical, 1080x1920), "16:9" (1920x1080) or "1:1" (1080x1080).',
  undoable: true,
  input: z.object({ preset: z.enum(["9:16", "16:9", "1:1"]) }),
  run(ctx, { preset }) {
    ctx.mutate(projectStore, (draft) => {
      draft.format = { ...FORMAT_PRESETS[preset] };
    });
    return FORMAT_PRESETS[preset];
  },
});

export const projectCommands = [setFormat];
