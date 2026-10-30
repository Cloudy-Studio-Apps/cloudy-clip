import { z } from "zod";
import { commandTool, defineMcpTool, errorResult, toAppError } from "@/core";
import { pause, play, seek } from "./preview.commands";
import { previewRef } from "./preview.ref";

const captureFrame = defineMcpTool({
  name: "preview_capture_frame",
  readOnly: true,
  description:
    "Returns a PNG of the preview, so you can see the result. Pass `time` (microseconds) to look at a specific moment (playback pauses); otherwise the current playhead is used.",
  input: z.object({ time: z.number().int().min(0).optional().describe("Microseconds") }),
  async handler({ time }, ctx) {
    const preview = ctx.require(previewRef);
    try {
      const data = await preview.captureFrame(time);
      return {
        content: [
          { type: "image", data, mimeType: "image/png" },
          { type: "text", text: JSON.stringify({ time: preview.playback.getTime() }) },
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
