import { z } from "zod";
import { commandTool, defineMcpTool, errorResult, toAppError } from "@/core";
import { projectRef } from "@/modules/project";
import { pause, play, seek } from "./preview.commands";
import { previewRef } from "./preview.ref";

const captureFrame = defineMcpTool({
  name: "preview_capture_frame",
  readOnly: true,
  description:
    "Returns a PNG of your open composition, so you can see the result. Pass `time` (microseconds) to look at a specific moment; otherwise your playhead is used. The user's preview doesn't move.",
  input: z.object({ time: z.number().int().min(0).optional().describe("Microseconds") }),
  async handler({ time }, ctx) {
    const preview = ctx.require(previewRef);
    try {
      const clock = preview.clockFor(ctx.caller.key);
      if (time !== undefined) clock.seek(time);
      const at = clock.getTime();
      const { id } = ctx.require(projectRef).view.requireOpen(ctx.caller.key);
      const data = await preview.captureAt(at, id);
      return {
        content: [
          { type: "image", data, mimeType: "image/png" },
          { type: "text", text: JSON.stringify({ time: at }) },
        ],
      };
    } catch (error) {
      return errorResult({ ...toAppError(error), code: "preview.capture_failed" });
    }
  },
});

export const previewMcpTools = [
  commandTool(play, { name: "preview_play" }),
  commandTool(pause, { name: "preview_pause" }),
  commandTool(seek, { name: "preview_seek" }),
  captureFrame,
];
